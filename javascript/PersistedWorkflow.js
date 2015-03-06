define(['configuration', 'jquery', 'knockout', 'knockoutmapping', 'durandal/system', 'plugins/http', 'plugins/observable', 'moment'],
  function(config, $, ko, mapping, system, http, observable, moment) {

    var persistedWorkflow = {};
    var self = persistedWorkflow;
    var Company = function() {
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.valueOf = function() {
          return this.Code;
        }
      },
      PayGroup = function() {
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.PayFrequencyCode = "";
        this.PayFrequency = null;
        this.PayCalendars = null;
        this.PayrollInitiated = null;
        this.CompanyCode = "";
        this.valueOf = function() {
          return this.Code;
        }
      },
      PayCalendar = function() {
        this.PayCalendarId = 0;
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.Type = "";
        this.AdjustmentType = false;
        this.DemandType = false;
        this.ScheduledType = false;
        this.SupplementalType = false;
        this.PayrollOfMonth = 0;
        this.PeriodBeginDate = "";
        this.PeriodEndDate = "";
        this.CheckDate = "";
        this.PayrollInitiated = false;
        this.PayrollPosted = false;
        this.PayGroupCode = "";
        this.YearsRecurringEarnings = null;
        this.valueOf = function() {
          return this.Code;
        }
      };
    var CheckType = function() {
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.valueOf = function() {
          return this.Code;
        }
      },
      MinimumWageCode = function() {
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.MinWageMakeup = false;
        this.RateFactorAmount = null;
        this.valueOf = function() {
          return this.Code;
        }
      },
      OvertimeCode = function() {
        this.Code = "";
        this.Name = "";
        this.Active = false;
        this.MinWageMakeup = false;
        this.RateFactorAmount = 0.0;
        this.valueOf = function() {
          return this.Code;
        }
      },
      CollectTimesheets = function() {
        this.CopyPayCalendar = new PayCalendar();
        this.CopyPayCalendar.Type = "__NotSet";
        this.GeneratedRecurringEarningsCount = null;
        this.GeneratedRecurringEarningsEmployeeCount = null;
        this.GeneratedRecurringEarningsTotal = null;
        this.CopyPreviousPayrollCount = null;
        this.CopyPreviousPayrollEmployeeCount = null;
        this.CopyPreviousPayrollTotal = null;
        this.ImportedFiles = [];
        this.StagedFiles = [];

      };

    var Settings = function() {
      this.Company = new Company();
      this.PayGroup = new PayGroup();
      this.PayCalendar = new PayCalendar();
      this.PayCalendar.Type = "__NotSet";
      this.CheckType = new CheckType();
      this.MinimumWageCode = new MinimumWageCode();
      this.OvertimeCode = new OvertimeCode();

      this.GenerateRecurringEarnings = false;
      this.ImportTimesheetFiles = false;
      this.CopyPreviousPayroll = false;
      this.BatchEntry = false;
      this.HcmEssWeeklyTimesheets = false;
      this.ManualTimeEntryOnly = false;
      this.ViewOneEmployeeAtATime = false;
      this.IncreaseToMinimumWage = false;
    };
    var ObjectModel = function() {
      this.Settings = new Settings();
      this.CollectTimesheets = new CollectTimesheets();
    };
    var PersistedWorkflowModel = function() {
      this.guid = "";
      this.Id = 0;
      this.EmployeeId = config.userId;
      this.WorkflowId = 18;
      this.CurrentStepId = 19;
      this.CurrentStepRoute = "settings";
      this.StartDate = moment().format();
      this.CompletionDate = "";
      this.Description = "";
      this.LastActivityDate = "";
      this.Object = new ObjectModel();
    };

    var get = function(id) {
        var deferred = system.defer(function(deferred) {
          http.get(config.apiUrl + '/users/persistedworkflows/processpayrolls/' + id)
            .then(function(data) {
              deferred.resolve(data);
            });
        });

        return deferred.promise();
      },
      upsert = function(data) {
        return system.defer(function(deferred) {
          var url = config.apiUrl + "/users/" + persistedWorkflow.instance.EmployeeId + "/persistedworkflows/processpayrolls";
          (data.Id ? http.put(url, data) : http.post(url, data))
          .then(function(data) {
            deferred.resolve(data);
          }, function(err) {
            deferred.reject(err);
          });
        }).promise();
      };

    persistedWorkflow.getInstance = function(caller) {
      return system.defer(function(deferred) {
        if(!self.hasOwnProperty('instance')) {
          self.instance = new PersistedWorkflowModel();
        }
        deferred.resolve(self.instance);
      }).promise();
    };

    persistedWorkflow.createWorkflow = function() {
      return system.defer(function(deferred) {
        var guid = system.guid();
        self.getInstance()
          .then(function(instance) {
            instance.guid = guid;
            deferred.resolve(instance);
          });
      }).promise();
    };

    persistedWorkflow.continueWorkflow = function(id) {
      return system.defer(function(deferred) {
        self.createWorkflow()
          .then(function(instance) {
            var guid = instance.guid;
            get(id)
              .then(function(data) {
                self.instance = data;
                self.instance.guid = guid;
                deferred.resolve(self.instance);
              });
          });
      }).promise();
    };

    persistedWorkflow.saveWorkflow = function() {
      var guid = self.instance.guid;
      return system.defer(function(deferred) {
        upsert(self.instance).then(function(data) {
          self.instance = data;
          self.instance.guid = guid;
          deferred.resolve(self.instance);
        });
      }).promise();
    };

    persistedWorkflow.inProcess = function() {
      return self.hasOwnProperty('instance');
    }
    persistedWorkflow.destroy = function() {
      if(self.hasOwnProperty('instance')) delete self.instance;
    }
    persistedWorkflow.currentStepRoute = function() {
      return self.hasOwnProperty('instance') && self.instance.CurrentStepRoute ? self.instance.CurrentStepRoute : null;
    }
    persistedWorkflow.currentStepId = function() {
      return self.hasOwnProperty('instance') && self.instance.CurrentStepId ? self.instance.CurrentStepId : null;
    }
    persistedWorkflow.workflowMap = function(keyOrVal) {
      // HACK
      var workflowMap = [];
      workflowMap[19] = "settings";
      workflowMap[20] = "collecttimesheets";
      workflowMap[21] = "edittimesheets";
      workflowMap[22] = "validatepost";
      workflowMap[23] = "summary";

      return $.isNumeric(keyOrVal) ? workflowMap[keyOrVal] : workflowMap.indexOf(keyOrVal);
    }

    return persistedWorkflow;
  });