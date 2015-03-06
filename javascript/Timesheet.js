define(['configuration', 'durandal/system', 'plugins/http', 'knockout'],
    function(config, system, http, ko) {
      // object model for import request
      var ImportTimeRequest = function(data) {
          //  debugger;
          this.TempFileId = data.Id;
          this.FileName = data.FileName ? data.FileName : null;
          this.PayCalendarId = data.PayCalendar ? data.PayCalendar.PayCalendarId : data.PayCalendarId;
          this.DeleteFirst = data.DeleteFirst ? data.DeleteFirst : false;
          this.CheckCd = data.CheckType ? data.CheckType.Code : data.CheckCd;
          this.ShiftPay = data.ShiftPay ? data.ShiftPay : false;
          this.MinWage = data.IncreaseToMinimumWage ? data.IncreaseToMinimumWage : data.MinWage;
          this.MinWageEarningCd = data.MinimumWageCode ? data.MinimumWageCode.Code : data.MinWageEarningCd;
          this.MinWageOvertimeCd = data.OvertimeCode ? data.OvertimeCode.Code : data.MinWageOvertimeCd;
        }
        // object model for response from import request
      var ImportedFilesOption = function(data) {
        this.CriticalWarningsCount = data.CriticalWarningsCount;
        this.EndTime = data.EndTime;
        this.FileName = data.FileName;
        this.FilePath = data.FilePath;
        this.Guid = data.Guid;
        this.NonCriticalWarningsCount = data.NonCriticalWarningsCount;
        this.StartTime = data.StartTime;
      }

      // the viewmodel
      var Timesheet = function(Id, filename, defaults) {
          var defaults = system.extend({
            Id: Id
          }, defaults);
          var self = this;
          var importStatusInterval = null;
          this.filename = filename;
          this.uploadComplete = false; // importRequest has been uploaded and staged
          this.importInProgress = false; // toggles loading indicator
          this.importComplete = false; //  import is complete and nothing left to be done       
          this.importWarnings = 0; // NonCriticalWarnings
          this.importErrors = 0; // CriticalWarnings
          this.importSuccess = false; // import has no warnings or errors       
          this.importStatus = null; // result of polled call to import status, once it returns a 200        
          this.importTimeRequest = new ImportTimeRequest(defaults);
          this.importedFilesOption = null; // the response from an importTimeRequest

          this.importStatusDeferred = system.defer(); // resolves when importStatus is complete
          this.pollForImportStatus = function() {

            if(!self.importedFilesOption) {
              importStatusDeferred.reject('importStatusPromise: importedFilesOption is null');
            }

            importStatusInterval = setInterval(function() {
              self.importInProgress = true;
              http.get(config.apiUrl + "/services/workitems/" + self.importedFilesOption.Guid)
                .then(function(data) {
                  if(data && 'undefined' !== typeof data['Status']) {
                    self.importStatus = data.Status;
                    self.importStatusDeferred.resolve(self);
                  }
                  else {
                    self.importStatusDeferred.reject('pollForImportStatus had an accident');
                  }
                }, function(err) {
                  self.importStatusDeferred.reject(err);
                });
            }, 3000);

            // end polling and disable loading indicator, regardless of reject() or resolve()
            self.importStatusDeferred
              .promise()
              .finally(function() {
                clearInterval(importStatusInterval);
              });
            return self.importStatusDeferred.promise();
          };

          this.warningsCountDeferred = system.defer(); // resolves when warningCount is complete
          this.pollForWarningsCount = function() {
              var self = this;
              `
    var warningsCountInterval = null;
             
    if (!self.importedFilesOption){
        self.warningsCountDeferred.reject('warningsCountPromise: importedFilesOption is null');
    }
          
    warningsCountInterval = setInterval(function(){
      self.importInProgress = true;
      http.get(config.apiUrl + "/payrolls/timefiles/warningCounts?logTime=" + self.importedFilesOption.StartTime)
          .then(function(data){
            if (data && 'undefined' !== typeof data['NonCriticalWarningsCount']){
                self.importWarnings = data.NonCriticalWarningsCount;
                self.importErrors = data.CriticalWarningsCount;
                self.warningsCountDeferred.resolve(self);
            }else{
                // something weird happened
                self.warningsCountDeferred.reject('pollForWarningsCount had an accident');
                
            }
          },function(err) {
            self.warningsCountDeferred.reject(err);
          });
    }, 3000);
     
    self.warningsCountDeferred
      .promise()
      .finally(function(){
          clearInterval(warningsCountInterval);
          self.importSuccess = !(self.importWarnings > 0 || self.importErrors > 0);
          self.importInProgress = false;
      });

      return self.warningsCountDeferred.promise();
  };

  this.import = function(){
    var self = this;
    var deferred = system.defer(function(deferred) {
      self.importInProgress = true;
      $.ajax({
          type: 'PUT',
          url: config.apiUrl + "/payrolls/timefiles",
          contentType: "application/json; charset=utf-8",
          dataType: 'json',
          data: http.toJSON(self.importTimeRequest),
          statusCode: {
              500: function() { console.log("500 %o", arguments); }
          },
          success: function(data) {
            self.importedFilesOption = new ImportedFilesOption(data);
            deferred.resolve(self);
          },
          error: function(jqXHR, textStatus) {
            deferred.reject(textStatus);
          }
      });
    });

    deferred
      .promise()
      .then(function() {
        self.importInProgress = true;
        self.pollForImportStatus()
          .then(function() {
            self.pollForWarningsCount()
              .then(function(){
                self.importComplete = true;
                self.importInProgress = false;
              });
          });
        });
        return deferred.promise();
    }
  }
  return Timesheet;
});