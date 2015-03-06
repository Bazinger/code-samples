define(['durandal/system', 'q', 'plugins/http', 'jquery', 'knockout'],
  function(system, Q, http, $, ko) {
    // patch so Durandal uses Q Promises instead of jquery's janky implementation
    // see http://durandaljs.com/documentation/Q.html
    system.defer = function(action) {
      var deferred = Q.defer(),
        promise = null;
      if(action) {
        action.call(deferred,
          dferred);
      }
      promise = deferred.promise;
      deferred.promise = function() {
        return promise;
      };
      return deferred;
    };

    // also patch Durandal http plugin to wrap ajax calls with Q.when()
    // see http://durandaljs.com/documentation/Q.html
    http.get = function(url, query, headers) {
      return Q.when($.ajax(url, {
        data: query,
        headers: ko.toJS(headers)
      }));
    };
    http.put = function(url, data, headers) {
      return Q.when(
        $.ajax({
          url: url,
          data: http.toJSON(data),
          type: 'PUT',
          contentType: 'application/json',
          dataType: 'json',
          headers: ko.toJS(headers)
        }));
    };
    http.post = function(url, data, headers) {
      return Q.when(
        $.ajax({
          url: url,
          data: http.toJSON(data),
          type: 'POST',
          contentType: 'application/json',
          dataType: 'json',
          headers: ko.toJS(headers)
        }));
    };

    http.remove = function(url, query, headers) {
      return Q.when(
        $.ajax({
          url: url,
          data: query,
          type: 'DELETE',
          headers: ko.toJS(headers)
        }));
    };

    (function() {
      var hasDomDataExpandoProperty = '__ko__hasDomDataOptionValue__';

      // Normally, SELECT elements and their OPTIONs can only take value of type 'string' (because the values
      // are stored on DOM attributes). ko.selectExtensions provides a way for SELECTs/OPTIONs to have values
      // that are arbitrary objects. This is very convenient when implementing things like cascading dropdowns.
      ko.selectExtensions = {
        readValue: function(element) {

          switch(ko.utils.tagNameLower(element)) {
            case 'option':

              if(element[hasDomDataExpandoProperty] === true) {
                return ko.utils.domData.get(element, ko.bindingHandlers.options.optionValueDomDataKey);

              }
              return ko.utils.ieVersion <= 7 ? (element.getAttributeNode('value') && element.getAttributeNode('value').specified ? element.value : element.text) : element.value;
            case 'select':
              return element.selectedIndex >= 0 ? ko.selectExtensions.readValue(element.options[element.selectedIndex]) : undefined;
            default:
              return element.value;

          }
        },

        writeValue: function(element, value, allowUnset) {

          switch(ko.utils.tagNameLower(element)) {
            case 'option':
              switch(typeof value) {
                case "string":
                  ko.utils.domData.set(element, ko.bindingHandlers.options.optionValueDomDataKey, undefined);
                  if(hasDomDataExpandoProperty in element) { // IE <= 8 throws errors if you delete non-existent properties from a DOM node
                    delete element[hasDomDataExpandoProperty];
                  }
                  element.value = value;
                  break;
                default:
                  // Store arbitrary object using DomData
                  ko.utils.domData.set(element, ko.bindingHandlers.options.optionValueDomDataKey, value);
                  element[hasDomDataExpandoProperty] = true;

                  // Special treatment of numbers is just for backward compatibility. KO 1.2.1 wrote numerical values to element.value.
                  element.value = typeof value === "number" ? value : "";
                  break;
              }
              break;
            case 'select':

              if(value === "" || value === null) { // A blank string or null value will select the caption
                value = undefined;
              }

              var selection = -1;
              for(var i = 0, n = element.options.length, optionValue; i < n; ++i) {

                optionValue = ko.selectExtensions.readValue(element.options[i]);

                // HACK to check for objects
                var checkForObjects = (value !== undefined && value.hasOwnProperty('Code') && optionValue.hasOwnProperty('Code') && optionValue.Code === value.Code)

                // Include special check to handle selecting a caption with a blank string value
                if(optionValue == value || (optionValue == "" && value === undefined) || checkForObjects) {

                  selection = i;
                  break;
                }
              }
              if(allowUnset || selection >= 0 || (value === undefined && element.size > 1)) {
                element.selectedIndex = selection;
              }
              break;
            default:
              if((value === null) || (value === undefined))
                value = "";
              element.value = value;
              break;
          }
        }
      };
    })();

    // adds a binding handler for jquery file upload
    //http://stackoverflow.com/questions/14899637/knockout-js-templates-and-jquery-file-upload
    ko.bindingHandlers.fileupload = {
      update: function(element, valueAccessor) {
        var options = valueAccessor() || {};
        options.dropZone = $('.droppable-region');
        //initialize
        $(element).fileupload(options);
      }
    };
    // adds support fo asynchronous computed observables via extender
    // http://smellegantcode.wordpress.com/2012/12/10/asynchronous-computed-observables-in-knockout-js/
    ko.extenders.async = function(computedDeferred, initialValue) {
      var plainObservable = ko.observable(initialValue),
        currentDeferred;
      plainObservable.inProgress = ko.observable(false);

      ko.computed(function() {
        if(currentDeferred) {
          currentDeferred.reject();
          currentDeferred = null;
        }

        var newDeferred = computedDeferred();
        if(newDeferred &&
          (typeof newDeferred.done === "function")) {

          // It's a deferred
          plainObservable.inProgress(true);

          // Create our own wrapper so we can reject
          currentDeferred = Q.defer();
          currentDeferred.promise.then(function(data) {
            plainObservable.inProgress(false);
            plainObservable(data);
          });

          newDeferred.then(currentDeferred.resolve);
        }
        else {
          // A real value, so just publish it immediately
          plainObservable(newDeferred);
        }
      });

      return plainObservable;
    };
  });