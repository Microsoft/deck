'use strict';

let angular = require('angular');

module.exports = angular.module('spinnaker.kubernetes.cache.initializer', [
  require('../../core/account/account.service.js'),
  require('../../core/loadBalancer/loadBalancer.read.service.js'),
  require('../../core/instance/instanceTypeService.js'),
  require('../../core/securityGroup/securityGroup.read.service.js'),
])
  .factory('kubernetesCacheConfigurer', function (accountService, instanceTypeService, loadBalancerReader) {

    let config = Object.create(null);

    config.credentials = {
      initializers: [ () => accountService.getRegionsKeyedByAccount('kubernetes') ],
    };

    config.instanceTypes = {
      initializers: [ () => instanceTypeService.getAllTypesByRegion('kubernetes') ],
    };

    config.loadBalancers = {
      initializers: [ () => loadBalancerReader.listLoadBalancers('kubernetes') ],
    };

    return config;
  });
