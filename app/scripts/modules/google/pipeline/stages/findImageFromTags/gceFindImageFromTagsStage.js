'use strict';

import {BAKERY_SERVICE} from 'core/pipeline/config/stages/bake/bakery.service';
import {PIPELINE_CONFIG_PROVIDER} from 'core/pipeline/config/pipelineConfigProvider';

let angular = require('angular');

module.exports = angular.module('spinnaker.core.pipeline.stage.gce.findImageFromTagsStage', [
  BAKERY_SERVICE,
  PIPELINE_CONFIG_PROVIDER,
  require('./findImageFromTagsExecutionDetails.controller.js'),
])
  .config(function (pipelineConfigProvider) {
    pipelineConfigProvider.registerStage({
      provides: 'findImageFromTags',
      cloudProvider: 'gce',
      templateUrl: require('./findImageFromTagsStage.html'),
      executionDetailsUrl: require('./findImageFromTagsExecutionDetails.html'),
      validators: [
        { type: 'requiredField', fieldName: 'packageName', },
        { type: 'requiredField', fieldName: 'regions', },
        { type: 'requiredField', fieldName: 'tags', },
      ],
    });
  })
  .controller('gceFindImageFromTagsStageCtrl', function($scope, bakeryService) {
    $scope.stage.tags = $scope.stage.tags || {};
    $scope.stage.regions = $scope.stage.regions || [];
    $scope.stage.cloudProvider = $scope.stage.cloudProvider || 'gce';

    bakeryService.getRegions('gce').then(function(regions) {
      $scope.regions = regions;
    });
  });
