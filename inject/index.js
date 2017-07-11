
(() => {

  const copyOverlay = (type, titleOptions) => `<div class="kuiModalOverlay myModalOverlay"><div class="kuiModal ng-scope" style="width: 450px" data-test-subj="confirmModal">
  <!-- ngIf: title -->
  <div class="kuiModalBody">
    <div class="kuiModalBodyText ng-binding" data-test-subj="confirmModalBodyText">
      Select the index pattern to which you want to copy the selected ${type}:
      <select class="mySelectIndex">
        ${titleOptions}
      </select>
    </div>
  </div>

  <div class="kuiModalFooter">
    <button class="kuiButton kuiButton--hollow ng-binding myCopyCancel" data-test-subj="confirmModalCancelButton" >
      Cancel
    </button>
    <button class="kuiButton kuiButton--primary ng-binding myCopy" data-test-subj="confirmModalConfirmButton" ng-click="onConfirm()">
      Copy ${type}
    </button>
  </div>
</div></div>`;

  const copySearch = (item, indexName, time) => {
    return new Promise((resolve, reject) => {

      const copy = Object.assign({}, item);
      copy.title = `${copy.title}_${indexName}_${time}`.replace(/-/g, '_').replace(/:/g, '_').replace(/ /g, '_');

      $.get(`/.kibana/_search?q=title:${encodeURI(copy.title)}`, {
        size: 1
      }, (resp) => {
        const existing = resp.hits.hits[0];
        if (existing) {
          return resolve(existing);
        }

        const searchSource = JSON.parse(item.kibanaSavedObjectMeta.searchSourceJSON);
        searchSource.index = indexName;
        if (searchSource.meta !== undefined) {
          searchSource.meta.index = indexName;
        }
        copy.kibanaSavedObjectMeta.searchSourceJSON = JSON.stringify(searchSource);

        $.ajax({
          type: "POST",
          url: '/.kibana/search',
          data: JSON.stringify(copy),
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json; charset=UTF-8',
            'Pragma': 'no-cache',
          },
          success: (result, textStatus, jqXHR) => {
            resolve(result);
          },
          error: (jqXHR, textStatus, errorThrown) => {
            reject(errorThrown);
          },
          dataType: 'json'
        });
      });
    });
  };

  const copyVisualization = (visualization, indexName, time) => {
    return new Promise((resolve, reject) => {
      const copy = Object.assign({}, visualization);
      copy.title = `${copy.title}_${indexName}_${time}`.replace(/-/g, '_').replace(/:/g, '_').replace(/ /g, '_');

      function doSave(vis) {
        $.ajax({
          type: "POST",
          url: '/.kibana/visualization',
          data: JSON.stringify(vis),
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json; charset=UTF-8',
            'Pragma': 'no-cache',
          },
          success: (result, textStatus, jqXHR) => {
            resolve(result);
          },
          error: (jqXHR, textStatus, errorThrown) => {
            reject(errorThrown);
          },
          dataType: 'json'
        });
      }

      if (copy.savedSearchId) {
        copyItem(copy.savedSearchId, indexName, time).then((search) => {

          copy.savedSearchId = search._id;

          doSave(copy);
        })
          .catch(reject);
      } else{
        doSave(copy);
      }
    });
  };

  const promiseSerial = funcs =>
    funcs.reduce((promise, func) =>
      promise.then(result => func().then(Array.prototype.concat.bind(result))),
      Promise.resolve([]));


  const copyDashboard = (dashboard, indexName, time) => {
    return new Promise((resolve, reject) => {
      const copy = Object.assign({}, dashboard);
      copy.title = `${copy.title}_${indexName}_${time}`.replace(/-/g, '_').replace(/:/g, '_').replace(/ /g, '_');



      const panels = JSON.parse(copy.panelsJSON);
      const copyVisualizations = panels.map((visualization) => {
        return () => {
          const p = copyItem(visualization.id, indexName, time);
          p.visualization = visualization;
          return p;
        };
      });

      promiseSerial(copyVisualizations).then((search) => {
        panels.forEach((panel, index) => {
          panel.id = search[index]._id;
        });
        copy.panelsJSON = JSON.stringify(panels, null, 2);

        $.ajax({
          type: "POST",
          url: '/.kibana/dashboard',
          data: JSON.stringify(copy),
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json; charset=UTF-8',
            'Pragma': 'no-cache',
          },
          success: (result, textStatus, jqXHR) => {
            resolve(result);
          },
          error: (jqXHR, textStatus, errorThrown) => {
            reject(errorThrown);
          },
          dataType: 'json'
        });


      })
        .catch(reject);;
    });
  };
  const copyItem = (itemId, indexName, time) => {
    time = time || (new Date()).toISOString().substring(0, 19);
    return new Promise((resolve, reject) => {
      $.get(`/.kibana/_search?q=_id:${itemId}`, {
        size: 100
      }, (resp) => {
        const item = resp.hits.hits[0];
        if (item._type === 'search') {
          return copySearch(item._source, indexName, time).then(resolve).catch(reject);
        } else if (item._type === 'visualization') {
          return copyVisualization(item._source, indexName, time).then(resolve).catch(reject);
        } else if (item._type === 'dashboard') {
          return copyDashboard(item._source, indexName, time).then(resolve).catch(reject);
        }

      });
    });
  };

  const makeCopy = (event) => {
    event.preventDefault();
    const selectedItems = event.data;
    const myRe = /(\w)+/g;
    const words = myRe.exec($('.kuiTab-isSelected').text());
    $.get("/.kibana/index-pattern/_search", {
      size: 100
    }, (resp) => {
      console.log(resp); // server response
      const titles = resp.hits.hits.map((hit) => hit._source.title);
      console.log(titles);
      const titleOptions = titles.reduce((acc, curr, index) => {
        if (index === 0) {
          return acc + `<option value="${curr}" selected="selected">${curr}</option>`
        } else {
          return acc + `<option value="${curr}" >${curr}</option>`
        }
      }, '');

      var overlayHtml = copyOverlay(words[0], titleOptions);
      const overlay = $('body').append(overlayHtml);
      $('.myCopyCancel').click(() => {
        $('.myModalOverlay').remove();
      });

      $('.myCopy').click(() => {
        const indexName = $('.mySelectIndex').val();
        const copyPromises = selectedItems.map((item) => {
          return copyItem(item.id, indexName);
        });
        Promise.all(copyPromises).then(() => {
          $('.myModalOverlay').remove();
          window.location.reload();
        })
          .catch((error) => {
            window.alert(error.message || error);
            $('.myModalOverlay').remove();
          });

      });
    });
  };

  const copyButton = `<button class="kuiButton kuiButton--basic kuiButton--iconText mykibanacopy" ng-click="bulkExport()" aria-label="Export selected objects" ng-disabled="selectedItems.length == 0" disabled="disabled">
            <span aria-hidden="true" class="kuiButton__icon kuiIcon fa-copy"></span>
            Copy
          </button>`

  const waitForObject = (o) => {
    return new Promise((resolve, reject) => {
      try {
        const exists = o();
        if (exists !== undefined) {
          return resolve(exists);
        }
      }
      catch (error) { }
      const cancel = window.setInterval(() => {
        let nowExists = undefined;
        try {
          nowExists = o();
        }
        catch (error) { }
        if (nowExists !== undefined) {
          window.clearInterval(cancel);
          return resolve(nowExists);
        }
      }, 100)
    });
  };

  const waitForJQuery = () => waitForObject(() => window.$);
  const waitForAngular = () => waitForObject(() => window.angular);
  const waitForParentScope = () => waitForObject(() => {
    const result = window.angular.element('.kuiButton[ng-click="bulkExport()"]').scope();
    return result;
  }
  );

  const injectCopyButton = () => {
    waitForParentScope()
      .then((scope) => {
        if (scope === undefined) return;
        const parentScope = scope.$parent;
        const buttonContainer = $('.kuiButton[ng-click="bulkExport()"]').parent();
        if (buttonContainer.find('.mykibanacopy').length === 0) {
          buttonContainer.append(copyButton);
          $('.mykibanacopy').click(parentScope.selectedItems, makeCopy);
        }

        $('.kuiCheckBox').on('click', (el, event) => {
          if (parentScope.selectedItems.length === 0) {
            $('.mykibanacopy').prop('disabled', 'disabled')
          } else {
            $('.mykibanacopy').prop('disabled', '')
          }

        });
      });
  };

  document.addEventListener('DOMContentLoaded', () => {
    waitForJQuery()
      .then(waitForAngular())
      .then(() => {
        if (angular.element('body').scope() === undefined) {
          angular.reloadWithDebugInfo();
          return Promise.reject();
        }
      })
      .then(() => {
        const managementUrl = '/_plugin/kibana/app/kibana#/management/kibana/objects';
        window.onhashchange = function () {
          $('.mykibanacopy').prop('disabled', 'disabled');
          if (window.location.href.indexOf(managementUrl) >= 0) {
            injectCopyButton();
          }
        }
        if (window.location.href.indexOf(managementUrl) >= 0) {
          injectCopyButton();
        }
      });
  }, false);


})();
