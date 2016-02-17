'use strict';

let angular = require('angular');

module.exports = angular.module('spinnaker.serverGroup.configure.gce.cloneServerGroup', [
  require('angular-ui-router'),
  require('../../../../core/application/modal/platformHealthOverride.directive.js'),
])
  .controller('gceCloneServerGroupCtrl', function($scope, $modalInstance, _, $q, $state,
                                                  serverGroupWriter, v2modalWizardService, taskMonitorService,
                                                  gceServerGroupConfigurationService,
                                                  serverGroupCommand, application, title) {
    $scope.pages = {
      templateSelection: require('./templateSelection.html'),
      basicSettings: require('./basicSettings.html'),
      loadBalancers: require('./loadBalancers.html'),
      securityGroups: require('./securityGroups.html'),
      instanceType: require('./instanceType.html'),
      capacity: require('./capacity.html'),
      advancedSettings: require('./advancedSettings.html'),
    };

    $scope.title = title;

    $scope.applicationName = application.name;
    $scope.application = application;

    $scope.command = serverGroupCommand;

    $scope.state = {
      loaded: false,
      requiresTemplateSelection: !!serverGroupCommand.viewState.requiresTemplateSelection,
    };

    function onApplicationRefresh() {
      // If the user has already closed the modal, do not navigate to the new details view
      if ($scope.$$destroyed) {
        return;
      }
      let [cloneStage] = $scope.taskMonitor.task.execution.stages.filter((stage) => stage.type === 'cloneServerGroup');
      if (cloneStage && cloneStage.context['deploy.server.groups']) {
        let newServerGroupName = cloneStage.context['deploy.server.groups'][$scope.command.region];
        if (newServerGroupName) {
          var newStateParams = {
            serverGroup: newServerGroupName,
            accountId: $scope.command.credentials,
            region: $scope.command.region,
            provider: 'gce',
          };
          var transitionTo = '^.^.^.clusters.serverGroup';
          if ($state.includes('**.clusters.serverGroup')) {  // clone via details, all view
            transitionTo = '^.serverGroup';
          }
          if ($state.includes('**.clusters.cluster.serverGroup')) { // clone or create with details open
            transitionTo = '^.^.serverGroup';
          }
          if ($state.includes('**.clusters')) { // create new, no details open
            transitionTo = '.serverGroup';
          }
          $state.go(transitionTo, newStateParams);
        }
      }
    }

    function onTaskComplete() {
      application.refreshImmediately();
      application.registerOneTimeRefreshHandler(onApplicationRefresh);
    }

    $scope.taskMonitor = taskMonitorService.buildTaskMonitor({
      application: application,
      title: 'Creating your server group',
      modalInstance: $modalInstance,
      onTaskComplete: onTaskComplete,
    });

    function configureCommand() {
      gceServerGroupConfigurationService.configureCommand(application, serverGroupCommand).then(function () {
        var mode = serverGroupCommand.viewState.mode;
        if (mode === 'clone' || mode === 'create') {
          if (!serverGroupCommand.backingData.packageImages || !serverGroupCommand.backingData.packageImages.length) {
            serverGroupCommand.viewState.useAllImageSelection = true;
          }
        }
        $scope.state.loaded = true;
        initializeSelectOptions();
        initializeWatches();
      });
    }

    function initializeWatches() {
      $scope.$watch('command.credentials', createResultProcessor($scope.command.credentialsChanged));
      $scope.$watch('command.region', createResultProcessor($scope.command.regionChanged));
      $scope.$watch('command.network', createResultProcessor($scope.command.networkChanged));
      $scope.$watch('command.viewState.instanceTypeDetails', updateStorageSettingsFromInstanceType());
    }

    function initializeSelectOptions() {
      processCommandUpdateResult($scope.command.credentialsChanged());
      processCommandUpdateResult($scope.command.regionChanged());
      processCommandUpdateResult($scope.command.networkChanged());
    }

    function createResultProcessor(method) {
      return function() {
        processCommandUpdateResult(method());
      };
    }

    function processCommandUpdateResult(result) {
      if (result.dirty.loadBalancers) {
        v2modalWizardService.markDirty('load-balancers');
      }
      if (result.dirty.securityGroups) {
        v2modalWizardService.markDirty('security-groups');
      }
      if (result.dirty.availabilityZones) {
        v2modalWizardService.markDirty('capacity');
      }
    }

    function updateStorageSettingsFromInstanceType() {
      return function(instanceTypeDetails) {
        if ($scope.command.viewState.initialized) {
          if (instanceTypeDetails && instanceTypeDetails.storage && instanceTypeDetails.storage.defaultSettings) {
            let defaultSettings = instanceTypeDetails.storage.defaultSettings;

            $scope.command.persistentDiskType = defaultSettings.persistentDiskType;
            $scope.command.persistentDiskSizeGb = defaultSettings.persistentDiskSizeGb;
            $scope.command.localSSDCount = defaultSettings.localSSDCount;

            delete $scope.command.viewState.overriddenStorageDescription;
          }
        } else {
          $scope.command.viewState.initialized = true;
        }
      };
    }

    this.isValid = function () {
      return $scope.command && ($scope.command.viewState.disableImageSelection || $scope.command.image !== null) &&
        ($scope.command.credentials !== null) && ($scope.command.instanceType !== null) &&
        ($scope.command.region !== null) && ($scope.command.zone !== null) &&
        ($scope.command.capacity.desired !== null) &&
        v2modalWizardService.isComplete();
    };

    this.showSubmitButton = function () {
      return v2modalWizardService.allPagesVisited();
    };

    function generateDiskDescriptors() {
      let persistentDiskDescriptor = {
        type: $scope.command.persistentDiskType,
        sizeGb: $scope.command.persistentDiskSizeGb
      };
      let localSSDDiskDescriptor = {
        type: 'local-ssd',
        sizeGb: 375
      };

      $scope.command.disks = Array($scope.command.localSSDCount + 1);
      $scope.command.disks[0] = persistentDiskDescriptor;

      _.fill($scope.command.disks, localSSDDiskDescriptor, 1);
    }

    this.clone = function () {
      generateDiskDescriptors();

      var origInstanceMetadata = $scope.command.instanceMetadata;
      var transformedInstanceMetadata = {};
      // The instanceMetadata is stored using 'key' and 'value' attributes to enable the Add/Remove behavior in the wizard.
      $scope.command.instanceMetadata.forEach(function(metadataPair) {
        transformedInstanceMetadata[metadataPair.key] = metadataPair.value;
      });

      // We use this list of load balancer names when 'Enabling' a server group.
      if ($scope.command.loadBalancers && $scope.command.loadBalancers.length > 0) {
        transformedInstanceMetadata['load-balancer-names'] = $scope.command.loadBalancers.toString();
      }
      $scope.command.instanceMetadata = transformedInstanceMetadata;

      var origTags = $scope.command.tags;
      var transformedTags = [];
      // The tags are stored using a 'value' attribute to enable the Add/Remove behavior in the wizard.
      $scope.command.tags.forEach(function(tag) {
        transformedTags.push(tag.value);
      });
      $scope.command.tags = transformedTags;

      $scope.command.targetSize = $scope.command.capacity.desired;

      // We want min/max set to the same value as desired.
      $scope.command.capacity.min = $scope.command.capacity.desired;
      $scope.command.capacity.max = $scope.command.capacity.desired;

      if ($scope.command.viewState.mode === 'editPipeline' || $scope.command.viewState.mode === 'createPipeline') {
        return $modalInstance.close($scope.command);
      }
      $scope.taskMonitor.submit(
        function() {
          var promise = serverGroupWriter.cloneServerGroup(angular.copy($scope.command), application);

          // Copy back the original objects so the wizard can still be used if the command needs to be resubmitted.
          $scope.command.instanceMetadata = origInstanceMetadata;
          $scope.command.tags = origTags;

          return promise;
        }
      );
    };

    this.cancel = function () {
      $modalInstance.dismiss();
    };

    if (!$scope.state.requiresTemplateSelection) {
      configureCommand();
    } else {
      $scope.state.loaded = true;
    }

    $scope.$on('template-selected', function() {
      $scope.state.requiresTemplateSelection = false;
      configureCommand();
    });
  });
