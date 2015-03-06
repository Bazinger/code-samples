# samples
### Michael Russo's sample code for prospective employers. 

_These files are part of a larger payroll management interface. Some of the design decisions and naming conventions may seem odd, this was beyond my control. My goal was to build a high performance and functional interface that fulfilled the client's requirements, and I believe I succeeded on that front. Please ignore any cruft!_


- patches.js
  - use Q instead of Durandal's standard jQuery promises.
  - patch file for knockout.js
- PersistedWorkflow.js (model)
- Timesheet.js (model)
  - manages asynchronous upload and reporting operations for timesheets
- timesheetUpload.js (viewmodel)
- timesheetUpload.html (view)


