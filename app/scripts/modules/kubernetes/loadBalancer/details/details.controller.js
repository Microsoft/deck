'use strict';

let angular = require('angular');

module.exports = angular.module('spinnaker.loadBalancer.kubernetes.details.controller', [
  require('angular-ui-router'),
  require('../../../core/account/account.service.js'),
  require('../../../core/confirmationModal/confirmationModal.service.js'),
  require('../../../core/loadBalancer/loadBalancer.write.service.js'),
  require('../../../core/loadBalancer/loadBalancer.read.service.js'),
  require('../../../core/utils/lodash.js'),
  require('../../../core/confirmationModal/confirmationModal.service.js'),
  require('../../../core/insight/insightFilterState.model.js'),
  require('../../../core/utils/selectOnDblClick.directive.js'),
])
  .controller('kubernetesLoadBalancerDetailsController', function ($scope, $state, $uibModal, loadBalancer, app, InsightFilterStateModel,
                                                                   _, confirmationModalService, accountService, loadBalancerWriter, loadBalancerReader, $q) {

    let application = app;

    $scope.state = {
      loading: true
    };

    $scope.InsightFilterStateModel = InsightFilterStateModel;

    function extractLoadBalancer() {
      $scope.loadBalancer = application.loadBalancers.filter(function (test) {
        return test.name === loadBalancer.name && test.namespace === loadBalancer.region && test.account === loadBalancer.accountId;
      })[0];

      if ($scope.loadBalancer) {
        $scope.state.loading = false;
      } else {
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

    extractLoadBalancer().then(() => {
      // If the user navigates away from the view before the initial extractLoadBalancer call completes,
      // do not bother subscribing to the autoRefreshStream
      if (!$scope.$$destroyed) {
        let refreshWatcher = app.autoRefreshStream.subscribe(extractLoadBalancer);
        $scope.$on('$destroy', () => refreshWatcher.dispose());
      }
    });

    this.editLoadBalancer = function editLoadBalancer() {
    };

    this.deleteLoadBalancer = function deleteLoadBalancer() {
    };

  }
);
