var ff = require('ff');
var chalk = require('chalk');
var logger = require('../util/logging').get('build');
var apps = require('../apps');

exports.build = function (appPath, argv, cb) {
  var startTime = Date.now();
  logger.log(chalk.cyan("starting build at", new Date()));

  var config;
  var elapsed = 0;
  function onFinish(err, res) {
    cb(err, merge({
      elapsed: elapsed,
      config: config
    }, res));
  }

  var onlyGetConfig = argv['get-config'];

  var app;
  var _hasLock = false;
  var f = ff(function () {
    apps.has(appPath, f());
  }, function (appLoaded) {
    var next = f.wait();
    apps.get(appPath, function (err, res) {
      if (err && !argv.help) {
        if (err.code == 'ENOENT') {
          logger.error('the current directory is not a devkit app');
        } else {
          logger.error(err);
        }
        next(err);
      } else {
        app = res;

        // ensure the manifest is up-to-date
        try {
          if (appLoaded) { app.reloadSync(); }
        } catch (e) {
          return next(e);
        }

        next();
      }
    });
  }, function () {
    // app.acquireLock(f());
  }, function () {
    // _hasLock = true;
    require('./steps/getConfig').getConfig(app, argv, f());
  }, function (res) {
    config = res;
    require('./steps/createDirectories').createDirectories(app, config, f());
  }, function () {
    require('./steps/buildHooks').getDependencies(app, config, f());
  }, function (deps) {
    // deps is an array of objects, merge them into one object and get all keys with false values
    deps = merge.apply(this, deps);
    var toRemove = Object.keys(deps).filter(function (name) { return deps[name] === false; });
    app.removeModules(toRemove);
  }, function () {
    require('./steps/addDebugCode')(app, config, f());
  }, function () {
    require('./steps/moduleConfig').getConfig(app, config, f());
  }, function () {
    require('./steps/buildHooks').onBeforeBuild(app, config, f());
  }, function () {
    // Skip to success
    if (onlyGetConfig) {
      // ONLY print config to stdout
      console.log(JSON.stringify(merge({title: app.manifest.title}, config)));
      process.exit(0);
    } else {
      require('./steps/logConfig').log(app, config, f());
    }
  }, function () {
    require('./steps/executeTargetBuild').build(app, config, f());
  }, function () {
    require('./steps/buildHooks').onAfterBuild(app, config, f());
  })
    .error(function (err) {
      if (err.code == 'EEXIST' && !_hasLock) {
        return logger.error('another build is already in progress');
      }

      logger.error("build failed");
      var errMsg;
      if (err.stack) {
        errMsg = err.stack;
      } else {
        errMsg = err;
      }
      logger.error(errMsg);
    })
    .success(function () {
      logger.log("build succeeded");
    })
    .cb(function () {
      if (_hasLock) {
        app.releaseLock(function (err) {
          if (err) {
            logger.error(err);
          }
        });
      }

      elapsed = (Date.now() - startTime) / 1000;
      var minutes = Math.floor(elapsed / 60);
      var seconds = (elapsed % 60).toFixed(2);
      logger.log((minutes ? minutes + ' minutes, ' : '') + seconds + ' seconds elapsed');
    })
    .cb(onFinish);
};

exports.showHelp = function (app, /* optional */ target) {
  require('./steps/executeTargetBuild').showHelp(app, target);
};
