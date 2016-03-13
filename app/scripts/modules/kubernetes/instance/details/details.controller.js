'use strict';

let angular = require('angular');

module.exports = angular.module('spinnaker.instance.detail.kubernetes.controller', [
  require('angular-ui-router'),
  require('angular-ui-bootstrap'),
  require('../../../core/instance/instance.write.service.js'),
  require('../../../core/instance/instance.read.service.js'),
  require('../../../core/confirmationModal/confirmationModal.service.js'),
  require('../../../core/utils/lodash.js'),
  require('../../../core/insight/insightFilterState.model.js'),
  require('../../../core/history/recentHistory.service.js'),
  require('../../../core/utils/selectOnDblClick.directive.js'),
  require('../../../core/cloudProvider/cloudProvider.registry.js'),
])
  .controller('kubernetesInstanceDetailsController', function ($scope, $state, $uibModal, InsightFilterStateModel,
                                                               instanceWriter, confirmationModalService, recentHistoryService,
                                                               cloudProviderRegistry, instanceReader, _, instance, app, $q) {
    // needed for standalone instances
    $scope.detailsTemplateUrl = cloudProviderRegistry.getValue('kubernetes', 'instance.detailsTemplateUrl');

    $scope.state = {
      loading: true,
      standalone: app.isStandalone,
    };

    $scope.InsightFilterStateModel = InsightFilterStateModel;

    this.showYaml = function showYaml() {
      $scope.userDataModalTitle = 'Pod YAML';
      $scope.userData = $scope.instance.yaml;
      $uibModal.open({
        templateUrl: require('../../../core/serverGroup/details/userData.html'),
        controller: 'CloseableModalCtrl',
        scope: $scope
      });
    };

    function retrieveInstance() {
      var extraData = {};
      var instanceSummary, loadBalancers, account, namespace;
      if (!app.serverGroups) {
        // standalone instance
        instanceSummary = {};
        loadBalancers = [];
        account = instance.account;
        namespace = instance.region;
      } else {
        app.serverGroups.data.some(function (serverGroup) {
          return serverGroup.instances.some(function (possibleInstance) {
            if (possibleInstance.id === instance.instanceId) {
              instanceSummary = possibleInstance;
              loadBalancers = serverGroup.loadBalancers;
              account = serverGroup.account;
              namespace = serverGroup.region;
              extraData.serverGroup = serverGroup.name;
              return true;
            }
          });
        });
        if (!instanceSummary) {
          // perhaps it is in a server group that is part of another application
          app.loadBalancers.data.some(function (loadBalancer) {
            return loadBalancer.instances.some(function (possibleInstance) {
              if (possibleInstance.id === instance.instanceId) {
                instanceSummary = possibleInstance;
                loadBalancers = [loadBalancer.name];
                account = loadBalancer.account;
                namespace = loadBalancer.region;
                return true;
              }
            });
          });
          if (!instanceSummary) {
            // perhaps it is in a disabled server group via a load balancer
            app.loadBalancers.data.some(function (loadBalancer) {
              return loadBalancer.serverGroups.some(function (serverGroup) {
                if (!serverGroup.isDisabled) {
                  return false;
                }
                return serverGroup.instances.some(function (possibleInstance) {
                  if (possibleInstance.id === instance.instanceId) {
                    instanceSummary = possibleInstance;
                    loadBalancers = [loadBalancer.name];
                    account = loadBalancer.account;
                    namespace = loadBalancer.region;
                    return true;
                  }
                });
              });
            });
          }
        }
      }

      if (instanceSummary && account && namespace) {
        extraData.account = account;
        extraData.namespace = namespace;
        recentHistoryService.addExtraDataToLatest('instances', extraData);
        return instanceReader.getInstanceDetails(account, namespace, instance.instanceId).then(function(details) {
          details = details.plain();
          $scope.state.loading = false;
          $scope.instance = _.defaults(details, instanceSummary);
          $scope.instance.account = account;
          $scope.instance.namespace = namespace;
          $scope.instance.region = namespace;
          $scope.instance.loadBalancers = loadBalancers;
          var pod = $scope.instance.pod;
          $scope.instance.dnsPolicy = pod.spec.dnsPolicy;
          $scope.instance.apiVersion = pod.apiVersion;
          $scope.instance.kind = pod.kind;
          $scope.instance.nodeName = pod.spec.nodeName;
          $scope.instance.restartPolicy = pod.spec.restartPolicy;
          $scope.instance.terminationGracePeriodSeconds = pod.spec.terminationGracePeriodSeconds;
          $scope.instance.hostIp = pod.status.hostIP;
          $scope.instance.podIp = pod.status.podIP;
          $scope.instance.phase = pod.status.phase;
          $scope.instance.volumes = pod.spec.volumes;
          $scope.instance.metadata = pod.metadata;
          $scope.instance.imagePullSecrets = pod.spec.imagePullSecrets;
          $scope.instance.containers = pod.spec.containers;
          $scope.instance.containerStatuses = pod.status.containerStatuses;
        },
          autoClose
        );
      }

      if (!instanceSummary) {
        autoClose();
      }

      return $q.when(null);
    }

    function autoClose() {
      if ($scope.$$destroyed) {
        return;
      }
      $state.params.allowModalToStayOpen = true;
      $state.go('^', null, {location: 'replace'});
    }

    this.canRegisterWithLoadBalancer = function() {
    };

    this.canDeregisterFromLoadBalancer = function() {
    };

    this.canRegisterWithDiscovery = function() {
    };

    this.terminateInstance = function terminateInstance() {
    };

    this.terminateInstanceAndShrinkServerGroup = function terminateInstanceAndShrinkServerGroup() {
    };

    this.rebootInstance = function rebootInstance() {
    };

    this.registerInstanceWithLoadBalancer = function registerInstanceWithLoadBalancer() {
    };

    this.deregisterInstanceFromLoadBalancer = function deregisterInstanceFromLoadBalancer() {
    };

    this.hasHealthState = function hasHealthState(healthProviderType, state) {
      var instance = $scope.instance;
      return (instance.health.some(function (health) {
        return health.type === healthProviderType && health.state === state;
      })
      );
    };

    let initialize = app.isStandalone ?
      retrieveInstance() :
      $q.all([app.serverGroups.ready(), app.loadBalancers.ready()]).then(retrieveInstance);

    initialize.then(() => {
      // Two things to look out for here:
      //  1. If the retrieveInstance call completes *after* the user has navigated away from the view, there
      //     is no point in subscribing to the refresh
      //  2. If this is a standalone instance, there is no application that will refresh
      if (!$scope.$$destroyed && !app.isStandalone) {
        app.serverGroups.onRefresh(retrieveInstance);
      }
    });

    $scope.account = instance.account;
  }
);
