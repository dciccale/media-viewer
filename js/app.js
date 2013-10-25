(function () {

  /*
   * NAVIGATION
   */
  var Navigation = function (root) {
    this.root = root;
    this.isRootPath = function (path) {
      return root.fullPath === path;
    };
  };

  Navigation.prototype.navigate = function (path) {
    app.ui.spinner.show();
    if (this.isRootPath(path)) {
      app._readEntries(this.root);
    } else {
      this.root.getDirectory(path, {create: false}, function (entry) {
        app._readEntries(entry);
      }, function (e) {
        app._log('getDirectory error callback', e);
      });
    }
  };

  Navigation.prototype.forward = function (entry) {
    this.history.add(entry.fullPath);
    this.navigate(this.history.getCurrPath());
    this.history.forward();
  };

  Navigation.prototype.back = function () {
    this.navigate(this.history.getPrevPath());
    this.history.back();
  };

  /*
   * HISTORY
   */
  Navigation.prototype.history = {
    paths: [],
    currPath: '',
    prevPath: '',
    level: 0,

    add: function (path) {
      if (this.paths.indexOf(path) === -1) {
        this.paths.push(path);
      }
      this.currPath = path;
    },

    getCurrPath: function () {
      return this.currPath;
    },

    getPrevPath: function () {
      return this.paths[this.level-2];
    },

    forward: function () {
      this.level++;
      if (this.level === 2) {
        app.ui.$backBtn.removeClass('pure-button-disabled');
      }
    },

    back: function () {
      this.level--;
      if (this.level === 1) {
        app.ui.$backBtn.addClass('pure-button-disabled');
      }
    }
  };


  /*
   * UI
   */
  var UI = function () {};

  UI.prototype.init = function () {
    this.$closeBtn = $('#close').on('click', blackberry.app.exit);
    this.$backBtn = $('#back').on('click', app.browseBack);
    this.$list = $('#list');
    this.spinner = {
      $el: $('#spinner'),
      $overlay: $('#spinner-overlay'),
      show: function () {
        this.$overlay.addClass('overlay-active');
        this.$el.addClass('icon-spin');
      },
      hide: function () {
        this.$overlay.removeClass('overlay-active');
        this.$el.removeClass('icon-spin');
      }
    };

    this.$list.on('click', 'li', function () {
      var entry = $(this).data('entry');
      if (entry.isFile) {
        blackberry.invoke.invoke({uri: 'file:///' + entry.fullPath},
          function () {
            app._log('invoke.invoke success');
          },
          function (e) {
            app._log('invoke.invoke error', e);
          });
      } else {
        app.navigation.forward(entry);
      }
    });
  };


  /*
   * APP
   */
  var App = function () {
    this.version = '1.0';
  };

  App.prototype.init = function () {
    app.ui.init();
    bbFilePicker.init();
    app.listDirs();
  };

  App.prototype.ui = new UI();

  // basic logger
  App.prototype._log = function () {
    if (console && console.log) {
      console.log.apply(console, arguments);
    }
  };

  // ---------------------------------------------------------------------------
  // HTML5 FILESYSTEM
  // ---------------------------------------------------------------------------
  var _slice = Array.prototype.slice;

  function toArray(list) {
    return _slice.call(list || [], 0);
  }

  App.prototype.listDirs = function () {
    window.webkitRequestFileSystem(window.TEMPORARY, 1024*1024, function (fs) {
      app.navigation = new Navigation(fs.root);
      app.navigation.forward(fs.root);
    }, function (e) {
      app._log('FileSystem error callback', e);
    });
  };

  App.prototype._readEntries = function (entry) {
    var that = this;
    var dirReader = entry.createReader();

    dirReader.readEntries(function (entries) {
      that._showFiles(entries);
      app.ui.spinner.hide();
    }, function (e) {
      app._log('readEntries error callback', e);
      app._log(app.navigation.history.paths);
      app.ui.spinner.hide();
    });
  };

  function getExtension(file) {
    return file.split('.').pop().toLowerCase();
  }

  App.prototype._showFiles = function (entries) {
    var that = this;
    var fragment = document.createDocumentFragment();

    toArray(entries)
      .filter(function (entry) {
        return !/^\./.test(entry.name);
      })
      .forEach(function (entry) {
        var $li = $(document.createElement('li'));
        var $icon = $(document.createElement('i'));
        var path = entry.fullPath.split('/');
        var iconClassName = '';
        var fileExtension = getExtension(entry.name);
        path = path[path.length - 2] + '/' + path[path.length - 1];

        if (entry.isDirectory) {
          iconClassName = 'icon-folder-close';
        } else {
          switch (fileExtension) {
            case 'jpg':
            case 'png':
              iconClassName = 'icon-picture';
              break;
            case 'mp3':
              iconClassName = 'icon-music';
              break;
            case 'mp4':
              iconClassName = 'icon-film';
              break;
          }
        }

        $icon.addClass(iconClassName);
        $li.addClass('pure-button')
          .data('entry', entry)
          .append($icon)
          .append(document.createTextNode(path))
        fragment.appendChild($li[0]);
      });

    app.ui.$list.empty()[0].appendChild(fragment);
  };

  App.prototype.browseBack = function () {
    app.navigation.back();
  };

  // ---------------------------------------------------------------------------
  // BLACKBERRY INVOKE CARD FILEPICKER API
  // ---------------------------------------------------------------------------
  var bbFilePicker = {
    init: function () {
      blackberry.io.sandbox = false;
      this.options = {
        mode: blackberry.invoke.card.FILEPICKER_MODE_PICKER,
        viewMode: blackberry.invoke.card.FILEPICKER_VIEWER_MODE_GRID,
        sortBy: blackberry.invoke.card.FILEPICKER_SORT_BY_NAME,
        sortOrder: blackberry.invoke.card.FILEPICKER_SORT_ORDER_DESCENDING,
      };
    },

    onDone: function (path) {
      var uri = 'file:///' + path;
      var invokeSuccess = function () {
        app._log('Invocation success!');
      };
      var invokeError = function (e) {
        app._log('Invocation failure', e);
      };
      blackberry.invoke.invoke({uri: uri}, invokeSuccess, invokeError);
    },

    onCancel: function (reason) {
      app._log('cancelled', reason);
    },

    onInvoke: function (e) {
      var msg = 'invokeFilePicker ' + (e ? 'error ' : 'success');
      if (e) {
        app._log(msg, e);
      } else {
        app._log(msg);
      }
    }
  };

  App.prototype.openFilepicker = function () {
    blackberry.invoke.card.invokeFilePicker(
      bbFilePicker.options,
      bbFilePicker.onDone,
      bbFilePicker.onCancel,
      bbFilePicker.onInvoke
    );
  };

  window.app = new App();
}());
