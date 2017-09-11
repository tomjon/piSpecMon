import { Directive, ElementRef, Input, Renderer, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { StateService } from './state.service';
import { WidgetComponent } from './widget.component';
import { Config } from './config';

let CURRENT_CLASS = 'current';
let DEFAULT_ROLES = ['admin', 'freq'];

/**
 * <input [disabled]="disabled" [ngClass]="{current: current}" ...>
 *
 * becomes
 *
 * <input psmInput="admin freq" ...>
 */
@Directive({
  selector: '[psmInput]'
})
export class InputDirective implements OnDestroy {

  private requiredRoles: string[] = DEFAULT_ROLES;

  private subscriptions: Subscription[] = [];

  private isCurrent: boolean = false;
  private isLoading: boolean = false;
  private isDisabled: boolean = false;

  constructor(private stateService: StateService,
              private widgetComponent: WidgetComponent,
              private el: ElementRef,
              private renderer: Renderer) {
    this.subscriptions.push(stateService.configChange.subscribe(config => this.config = config));
    this.subscriptions.push(widgetComponent.loadingChange.subscribe(loading => this.loading = loading));
  }

  ngOnDestroy(): void {
    for (let subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
  }

  @Input('psmInput') set setRequiredRoles(value: string) {
    if (value != '') {
      this.requiredRoles = value.split(/\s+/);
    }
    this.setDisabledProperty();
  }

  @Input() set disabled(value: boolean) {
    this.isDisabled = value;
    this.setDisabledProperty();
  }

  private set config(config: Config) {
    this.isCurrent = config != undefined;
    this.renderer.setElementClass(this.el.nativeElement, CURRENT_CLASS, this.isCurrent);
    this.setDisabledProperty();
  }

  private set loading(loading: boolean) {
    this.isLoading = loading;
    this.setDisabledProperty();
  }

  private setDisabledProperty(): void {
    let disabled = this.isLoading || this.isCurrent || ! this.stateService.user.roleIn(this.requiredRoles);
    this.renderer.setElementProperty(this.el.nativeElement, 'disabled', this.isDisabled || disabled);
  }

}
