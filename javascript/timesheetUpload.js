define(['configuration', 'durandal/system', 'durandal/app', 'plugins/observable', 'plugins/http', 'knockout', 'jquery', 'q', 'workflows/payroll/models/apiData', 'workflows/payroll/models/persistedWorkflow', 'workflows/payroll/models/Timesheet'],
  function(config, system, app, observable, http, ko, $, Q, apiData, PersistedWorkflow, Timesheet) {

    var timesheetUpload = {};
    var self = timesheetUpload;
    deleteTimeFiles = function(payCalendarId) {
        return system.defer(function(deferred) {
          http.remove(config.apiUrl + "/payrolls/timefiles/" + self.Settings.PayCalendar.PayCalendarId)
            .then(function(data) {
              deferred.resolve(data);
            }, function(err) {
              deferred.reject(err);
            });
        }).promise();
      },

      getLogResults = function(logTime) {
        return system.defer(function(deferred) {
          http.get(config.apiUrl + "/payrolls/timefiles/importlog?logTime=" + logTime)
            .then(function(data) {
              deferred.resolve(data);
            }, function(err) {
              deferred.reject(err);
            });
        }).promise();
      },

      processImport = function() {
        var importCompletePromises = [], // an array of promises that track when uploads are complete
          importStatusPromises = [], // an array of promises that track the importStatus of each import
          warningsCountPromises = [], // ditto warningCounts
          processImportDeferred = system.defer();

        self.timesheets.forEach(function(timesheet) {
          var importCompletePromise = timesheet.import()
            .then(function(timesheet) {
              importStatusPromises.push(timesheet.importStatusDeferred.promise());
              warningsCountPromises.push(timesheet.warningsCountDeferred.promise());
              self.CollectTimesheets.ImportedFiles.push(timesheet);
            });

          importCompletePromises.push(importCompletePromise);
        });

        Q.all(importCompletePromises) // these promises are resolved when all uploads are complete
          .then(function() {
            Q.all(importStatusPromises) // resolve after all importStatus calls are complete
              .then(function(timesheets) {
                Q.all(warningsCountPromises) // resolve after all warningsCount calls are complete
                  .then(function(timesheets) {
                    var hasWarnings = false,
                      hasErrors = false;
                    timesheets.forEach(function(timesheet) {
                      if(!hasWarnings && timesheet.importWarnings > 0) {
                        hasWarnings = true;
                      }
                      if(!hasErrors && timesheet.importErrors > 0) {
                        hasErrors = true;
                      }
                    });

                    self.hasWarnings = hasWarnings;
                    self.hasErrors = hasErrors;
                    self.hasSuccess = (!hasWarnings && !hasErrors);
                    processImportDeferred.resolve(self);
                  });
              });
          });
        return processImportDeferred.promise();
      };

    timesheetUpload.canActivate = function() {
      return system.defer(function(deferred) {
        PersistedWorkflow.getInstance()
          .then(function() {
            deferred.resolve(true);
          });
      }).promise();
    };

    timesheetUpload.activate = function() {
      return system.defer(function(deferred) {
        self.CollectTimesheets = PersistedWorkflow.instance.Object.CollectTimesheets;
        self.Settings = PersistedWorkflow.instance.Object.Settings;

        // set up dropdowns
        self.checkTypes = observable(apiData, 'checkTypes');
        self.minimumWageCodes = observable(apiData, 'minimumWageCodes');
        self.overtimeCodes = observable(apiData, 'overtimeCodes');

        // persisted workflow uploads
        self.timesheets = [];
        ko.utils.arrayForEach(self.CollectTimesheets.StagedFiles, function(importTimeRequest) {

          var defaults = {};
          defaults.Id = importTimeRequest.TempFileId;
          defaults.FileName = importTimeRequest.FileName;
          defaults.PayCalendarId = importTimeRequest.PayCalendarId;
          defaults.DeleteFirst = importTimeRequest.DeleteFirst;
          defaults.CheckCd = importTimeRequest.CheckCd;
          defaults.ShiftPay = importTimeRequest.ShiftPay;
          defaults.MinWage = importTimeRequest.MinWage;
          defaults.MinWageEarningCd = importTimeRequest.MinWageEarningCd;
          defaults.MinWageOvertimeCd = importTimeRequest.MinWageOvertimeCd;

          var timesheet = new Timesheet(importTimeRequest.TempFileId, importTimeRequest.FileName, defaults);
          self.timesheets.push(timesheet);
        });

        self.importComplete = false; // all files have finished importing
        self.hasSuccess = false; // ...with no errors or warnings
        self.hasWarnings = false; //...with warnings > 0 on any import
        self.hasErrors = false; // ...with errors > 0 on any import

        deferred.resolve();
      }).promise();
    };

    timesheetUpload.confirmDeleteTimefiles = function() {
      var deferred = system.defer();
      app.showMessage('Are you sure you want to delete the time records in this file?', 'Delete Timefiles', ['Yes', 'No'])
        .then(function(data) {

          if(data === 'Yes') return deleteTimeFiles(self.Settings.PayCalendar.PayCalendarId)
            .then(function(data) {
              self.timesheets = self.timesheets.filter(function(item) {
                if(!item.importComplete) return item;
              });
              self.importComplete = false;
              self.hasSuccess = false;
              self.hasWarnings = false;
              self.hasErrors = false;
              self.CollectTimesheets.StagedFiles = [];
              PersistedWorkflow.saveWorkflow()
                .then(function() {
                  deferred.resolve();
                });

            });
        });
      return deferred.promise();

    };

    timesheetUpload.importTimeFiles = function() {
      processImport()
        .then(function() {

          self.importComplete = true;
          self.CollectTimesheets.StagedFiles = [];
          PersistedWorkflow.saveWorkflow();
        });
    };

    timesheetUpload.confirmRemove = function(timesheet) {
      app.showMessage('Are you sure you to remove the upload from the import queue?', 'Delete Upload', ['Yes', 'No'])
        .then(function(data) {
          if(data === 'Yes') {
            self.timesheets = self.timesheets.filter(function(item) {
              if(item.filename != timesheet.filename) {
                return item;
              }
            });
          }
        });
    };

    timesheetUpload.fileuploadOptions = {
      type: 'PUT',
      url: config.apiUrl + "/temporaryfiles/timesheets",
      dropZone: $('.droppable-region'),
      add: function(e, data) {

        var goUpload = true;
        var uploadFile = data.files[0];

        //too big?
        if(uploadFile.size / 1000 > 4000) {
          goUpload = false;
        }
        if(goUpload == true) {
          $('#fileLocation').text(data.files[0].name);
          data.submit();
        }

      },
      done: function(e, data) {

        var timesheet = new Timesheet(data.result.Id, data.result.filename, self.Settings);
        //debugger;
        observable.convertObject(timesheet);

        timesheet.uploadComplete = true;
        timesheet.importTimeRequest.FileName = data.result.filename;
        self.CollectTimesheets.StagedFiles.push(timesheet.importTimeRequest);

        self.timesheets.push(timesheet);

      }
    };

    return timesheetUpload;
  });