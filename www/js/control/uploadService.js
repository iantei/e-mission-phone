'use strict';

import angular from 'angular';

angular.module('emission.services.upload', ['emission.plugin.logger'])

    .service('UploadHelper', function ($window, $http, $rootScope, $ionicPopup, Logger) {
        const getUploadConfig = function () {
            return new Promise(function (resolve, reject) {
                Logger.log(Logger.LEVEL_INFO, "About to get email config");
                var url = [];
                $http.get("json/uploadConfig.json").then(function (uploadConfig) {
                    Logger.log(Logger.LEVEL_DEBUG, "uploadConfigString = " + JSON.stringify(uploadConfig.data));
                    url.push(uploadConfig.data.url)
                    resolve(url);
                }).catch(function (err) {
                    $http.get("json/uploadConfig.json.sample").then(function (uploadConfig) {
                        Logger.log(Logger.LEVEL_DEBUG, "default uploadConfigString = " + JSON.stringify(uploadConfig.data));
                        url.push(uploadConfig.data.url)
                        resolve(url);
                    }).catch(function (err) {
                        Logger.log(Logger.LEVEL_ERROR, "Error while reading default upload config" + err);
                        reject(err);
                    });
                });
            });
        }

        const onReadError = function(err) {
            Logger.displayError("Error while reading log", err);
        }

        const onUploadError = function(err) {
            Logger.displayError("Error while uploading log", err);
        }

        const readDBFile = function(parentDir, database, callbackFn) {
            return new Promise(function(resolve, reject) {
                window.resolveLocalFileSystemURL(parentDir, function(fs) {
                    fs.filesystem.root.getFile(fs.fullPath+database, null, (fileEntry) => {
                        console.log(fileEntry);
                        fileEntry.file(function(file) {
                          console.log(file);
                          var reader = new FileReader();

                          reader.onprogress = function(report) {
                            console.log("Current progress is "+JSON.stringify(report));
                            if (callbackFn != undefined) {
                                callbackFn(report.loaded * 100 / report.total);
                            }
                          }

                          reader.onerror = function(error) {
                            console.log(this.error);
                            reject({"error": {"message": this.error}});
                          }

                          reader.onload = function() {
                            console.log("Successful file read with " + this.result.byteLength +" characters");
                            resolve(new DataView(this.result));
                          }

                          reader.readAsArrayBuffer(file);
                        }, reject);
                    }, reject);
                });
            });
        }

        const sendToServer = function upload(url, binArray, params) {
            var config = {
                headers: {'Content-Type': undefined },
                transformRequest: angular.identity,
                params: params
            };
            return $http.post(url, binArray, config);
        }

        this.uploadFile = function (database) {
          getUploadConfig().then((uploadConfig) => {
            var parentDir = "unknown";

            if (ionic.Platform.isAndroid()) {
                parentDir = cordova.file.applicationStorageDirectory+"/databases";
            }
            if (ionic.Platform.isIOS()) {
                parentDir = cordova.file.dataDirectory + "../LocalDatabase";
            }

            if (parentDir === "unknown") {
                alert("parentDir unexpectedly = " + parentDir + "!")
            }

            const newScope = $rootScope.$new();
            newScope.data = {};
            newScope.fromDirText = i18next.t('upload-service.upload-from-dir',  {parentDir: parentDir});
            newScope.toServerText = i18next.t('upload-service.upload-to-server',  {serverURL: uploadConfig});

            var didCancel = true;

            const detailsPopup = $ionicPopup.show({
                title: i18next.t("upload-service.upload-database", { db: database }),
                template: newScope.toServerText
                    + '<input type="text" ng-model="data.reason"'
                    +' placeholder="{{ \'upload-service.please-fill-in-what-is-wrong \' | translate}}">',
                scope: newScope,
                buttons: [
                  { 
                    text: 'Cancel',
                    onTap: function(e) {
                        didCancel = true;
                        detailsPopup.close();
                    }
                  },
                  {
                    text: '<b>Upload</b>',
                    type: 'button-positive',
                    onTap: function(e) {
                      if (!newScope.data.reason) {
                        //don't allow the user to close unless he enters wifi password
                        didCancel = false;
                        e.preventDefault();
                      } else {
                        didCancel = false;
                        return newScope.data.reason;
                      }
                    }
                  }
                ]
            });

            Logger.log(Logger.LEVEL_INFO, "Going to upload " + database);
            const readFileAndInfo = [readDBFile(parentDir, database), detailsPopup];
            Promise.all(readFileAndInfo).then(([binString, reason]) => {
              if(!didCancel)
              {  
                console.log("Uploading file of size "+binString.byteLength);
                const progressScope = $rootScope.$new();
                const params = {
                    reason: reason,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
                uploadConfig.forEach((url) => {
                    const progressPopup = $ionicPopup.show({
                        title: i18next.t("upload-service.upload-database",
                            {db: database}),
                        template: i18next.t("upload-service.upload-progress",
                            {filesizemb: binString.byteLength / (1000 * 1000),
                             serverURL: uploadConfig})
                            + '<center><ion-spinner></ion-spinner></center>',
                        scope: progressScope,
                        buttons: [
                            { text: '<b>Cancel</b>', type: 'button-cancel',  },
                        ]
                    });
                    sendToServer(url, binString, params).then((response) => {
                        console.log(response);
                        progressPopup.close();
                        const successPopup = $ionicPopup.alert({
                            title: i18next.t("upload-service.upload-success"),
                            template: i18next.t("upload-service.upload-details",
                                {filesizemb: binString.byteLength / (1000 * 1000),
                                 serverURL: uploadConfig})
                        });
                    }).catch(onUploadError);
                });
              }
            }).catch(onReadError);
          }).catch(onReadError);
        };
});
