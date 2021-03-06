import {IAngularEvent, IRootScopeService, module} from 'angular';
import {IState} from 'angular-ui-router';
import {extend} from 'lodash';

import {ICache} from 'core/cache/deckCache.service';
import {VIEW_STATE_CACHE_SERVICE, ViewStateCacheService} from 'core/cache/viewStateCache.service';

export class ExecutionFilterModel {
  // Store count globally for 180 days
  private configViewStateCache: ICache;

  private groupCount: number;
  private groupBy: string;
  private showStageDuration: boolean;

  // TODO: Convert filter.model.service to TS, create an interface, and have this class implement said interface
  private filterModel: any = this;
  // The following get set in filterModelService.configureFilterModel(this, filterModelConfig);
  public sortFilter: any;
  public groups: any;
  public addTags: () => void;
  public clearFilters: () => void;
  public applyParamsToUrl: () => void;

  static get $inject(): string[] { return ['$rootScope', 'filterModelService', 'urlParser', 'viewStateCache']; }

  constructor($rootScope: IRootScopeService,
              filterModelService: any,
              urlParser: any,
              viewStateCache: ViewStateCacheService) {
    this.configViewStateCache = viewStateCache.createCache('executionFilters', {
      version: 1,
      maxAge: 180 * 24 * 60 * 60 * 1000,
    });
    this.groupCount = this.getCachedViewState().count;
    this.groupBy = this.getCachedViewState().groupBy;
    this.showStageDuration = this.getCachedViewState().showStageDuration;

    const filterModelConfig = [
      { model: 'filter', param: 'q', clearValue: '', type: 'string', filterLabel: 'search', },
      { model: 'pipeline', param: 'pipeline', type: 'object', },
      { model: 'status', type: 'object', },
    ];
    filterModelService.configureFilterModel(this, filterModelConfig);

    let mostRecentParams: string = null;
    // WHY??? Because, when the stateChangeStart event fires, the $location.search() will return whatever the query
    // params are on the route we are going to, so if the user is using the back button, for example, to go to the
    // Infrastructure page with a search already entered, we'll pick up whatever search was entered there, and if we
    // come back to this application's clusters view, we'll get whatever that search was.
    $rootScope.$on('$locationChangeStart', (_event: IAngularEvent, toUrl: string, fromUrl: string) => {
      const [oldBase, oldQuery] = fromUrl.split('?'),
            [newBase, newQuery] = toUrl.split('?');

      if (oldBase === newBase) {
        mostRecentParams = newQuery ? urlParser.parseQueryString(newQuery) : {};
      } else {
        mostRecentParams = oldQuery ? urlParser.parseQueryString(oldQuery) : {};
      }
    });

    $rootScope.$on('$stateChangeStart', (_event: IAngularEvent, toState: IState, _toParams: {}, fromState: IState, fromParams: {}) => {
      if (this.movingFromExecutionsState(toState, fromState)) {
        this.filterModel.saveState(fromState, fromParams, mostRecentParams);
      }
    });

    $rootScope.$on('$stateChangeSuccess', (_event: IAngularEvent, toState: IState, toParams: {}, fromState: IState) => {
      if (this.movingToExecutionsState(toState) && this.isExecutionStateOrChild(fromState.name)) {
        this.filterModel.applyParamsToUrl();
        return;
      }
      if (this.movingToExecutionsState(toState)) {
        if (this.shouldRouteToSavedState(toParams, fromState)) {
          this.filterModel.restoreState(toParams);
        }
        if (this.fromApplicationListState(fromState) && !this.filterModel.hasSavedState(toParams)) {
          this.filterModel.clearFilters();
        }
      }
    });

    // A nice way to avoid watches is to define a property on an object
    Object.defineProperty(this.filterModel.sortFilter, 'count', {
      get: () => this.groupCount,
      set: (count) => {
        this.groupCount = count;
        this.cacheConfigViewState();
      }
    });

    Object.defineProperty(this.filterModel.sortFilter, 'groupBy', {
      get: () => this.groupBy,
      set: (grouping) => {
        this.groupBy = grouping;
        this.cacheConfigViewState();
      }
    });

    Object.defineProperty(this.filterModel.sortFilter, 'showStageDuration', {
      get: () => this.showStageDuration,
      set: (newVal) => {
        this.showStageDuration = newVal;
        this.cacheConfigViewState();
      }
    });

    this.filterModel.activate();
  }

  private getCachedViewState(): { count: number, groupBy: string, showDurations: boolean, showStageDuration: boolean } {
    const cached = this.configViewStateCache.get('#global') || {},
        defaults = { count: 2, groupBy: 'name', showDurations: false };
    return extend(defaults, cached);
  }

  private cacheConfigViewState(): void {
    this.configViewStateCache.put('#global', { count: this.groupCount, groupBy: this.groupBy, showStageDuration: this.showStageDuration });
  }

  private isExecutionState(stateName: string): boolean {
    return stateName === 'home.applications.application.pipelines.executions' ||
      stateName === 'home.project.application.pipelines.executions';
  }

  private isChildState(stateName: string): boolean {
    return stateName.includes('executions.execution');
  }

  private isExecutionStateOrChild(stateName: string): boolean {
    return this.isExecutionState(stateName) || this.isChildState(stateName);
  }

  private movingToExecutionsState(toState: IState): boolean {
    return this.isExecutionStateOrChild(toState.name);
  }

  private movingFromExecutionsState (toState: IState, fromState: IState): boolean {
    return this.isExecutionStateOrChild(fromState.name) && !this.isExecutionStateOrChild(toState.name);
  }

  private fromApplicationListState(fromState: IState): boolean {
    return fromState.name === 'home.applications';
  }

  private shouldRouteToSavedState(toParams: {}, fromState: IState): boolean {
    return this.filterModel.hasSavedState(toParams) && !this.isExecutionStateOrChild(fromState.name);
  }
}

export let executionFilterModel: ExecutionFilterModel = undefined;
export const EXECUTION_FILTER_MODEL = 'spinnaker.core.delivery.filter.executionFilter.model';
module (EXECUTION_FILTER_MODEL, [
  require('core/filterModel/filter.model.service'),
  require('core/navigation/urlParser.service'),
  VIEW_STATE_CACHE_SERVICE
]).factory('executionFilterModel', ($rootScope: IRootScopeService, filterModelService: any, urlParser: any, viewStateCache: ViewStateCacheService) =>
                                    new ExecutionFilterModel($rootScope, filterModelService, urlParser, viewStateCache))
  .run(($injector: any) => executionFilterModel = <ExecutionFilterModel>$injector.get('executionFilterModel'));
