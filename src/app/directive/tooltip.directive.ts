import {
  AfterViewInit,
  ComponentFactoryResolver,
  ComponentRef,
  Directive,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewContainerRef,
} from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { TabletopObject } from '@udonarium/tabletop-object';
import { OverviewPanelComponent } from 'component/overview-panel/overview-panel.component';
import { ContextMenuService } from 'service/context-menu.service';
import { PointerDeviceService } from 'service/pointer-device.service';

@Directive({
  selector: '[appTooltip]'
})
export class TooltipDirective implements OnInit, AfterViewInit, OnDestroy {
  private static activeTooltips: ComponentRef<OverviewPanelComponent>[] = [];

  @Input('appTooltip') tabletopObject: TabletopObject;

  private callbackOnMouseEnter = (e) => this.onMouseEnter(e);
  private callbackOnMouseLeave = (e) => this.onMouseLeave(e);
  private callbackOnMouseDown = (e) => this.onMouseDown(e);

  private openTooltipTimer: NodeJS.Timer;
  private closeTooltipTimer: NodeJS.Timer;

  private TooltipComponentRef: ComponentRef<OverviewPanelComponent>

  constructor(
    private ngZone: NgZone,
    private viewContainerRef: ViewContainerRef,
    private componentFactoryResolver: ComponentFactoryResolver,
    private pointerDeviceService: PointerDeviceService
  ) { }

  ngOnInit() { }

  ngAfterViewInit() {
    this.addEventListeners(this.viewContainerRef.element.nativeElement);
  }

  ngOnDestroy() {
    this.removeEventListeners(this.viewContainerRef.element.nativeElement);
    this.clearTimer();
  }

  private onMouseEnter(e: any) {
    this.clearTimer();
    if (!this.TooltipComponentRef) this.startOpenTimer();
  }

  private onMouseLeave(e: any) {
    this.clearTimer();
    if (this.TooltipComponentRef) this.startCloseTimer();
  }

  private onMouseDown(e: any) {
    if (!this.TooltipComponentRef) return;
    if (!this.TooltipComponentRef.location.nativeElement.contains(e.target)
      && !this.viewContainerRef.element.nativeElement.contains(e.target)) {
      this.ngZone.run(() => this.close());
    }
  }

  private startOpenTimer() {
    let pointerX = this.pointerDeviceService.pointerX;
    let pointerY = this.pointerDeviceService.pointerY;

    this.openTooltipTimer = setTimeout(() => {
      let magnitude = (pointerX - this.pointerDeviceService.pointerX) ** 2 + (pointerY - this.pointerDeviceService.pointerY) ** 2;
      if (9 < magnitude) {
        this.startOpenTimer();
      } else {
        this.ngZone.run(() => this.open());
      }
    }, 150);
  }

  private startCloseTimer() {
    this.closeTooltipTimer = setTimeout(() => {
      if (this.TooltipComponentRef && this.TooltipComponentRef.location.nativeElement.contains(document.activeElement)) {
        this.startCloseTimer();
      } else {
        this.ngZone.run(() => this.close());
      }
    }, 400);
  }

  private clearTimer() {
    clearTimeout(this.closeTooltipTimer);
    clearTimeout(this.openTooltipTimer);
  }

  private open() {
    this.close();
    if (this.pointerDeviceService.isDragging) return;

    let parentViewContainerRef = ContextMenuService.defaultParentViewContainerRef;

    const injector = parentViewContainerRef.injector;
    const panelComponentFactory = this.componentFactoryResolver.resolveComponentFactory(OverviewPanelComponent);

    this.TooltipComponentRef = parentViewContainerRef.createComponent(panelComponentFactory, parentViewContainerRef.length, injector);

    this.TooltipComponentRef.instance.tabletopObject = this.tabletopObject;
    this.TooltipComponentRef.instance.left = this.pointerDeviceService.pointerX;
    this.TooltipComponentRef.instance.top = this.pointerDeviceService.pointerY;

    this.addEventListeners(this.TooltipComponentRef.location.nativeElement);
    this.ngZone.runOutsideAngular(() => {
      document.body.addEventListener('mousedown', this.callbackOnMouseDown, false);
    });

    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', -1000, event => {
        if (this.tabletopObject && this.tabletopObject.identifier === event.data.identifier) this.close();
      });

    this.TooltipComponentRef.onDestroy(() => {
      this.removeEventListeners(this.TooltipComponentRef.location.nativeElement);
      document.body.removeEventListener('mousedown', this.callbackOnMouseDown, false);
      this.clearTimer();
      this.TooltipComponentRef = null;
      EventSystem.unregister(this);
    });
    TooltipDirective.activeTooltips.push(this.TooltipComponentRef);
  }

  private close() {
    TooltipDirective.activeTooltips.forEach(componentRef => componentRef.destroy());
    TooltipDirective.activeTooltips = [];

    if (!this.TooltipComponentRef) return;
    this.TooltipComponentRef.destroy();
  }

  private addEventListeners(element: Element) {
    this.ngZone.runOutsideAngular(() => {
      element.addEventListener('mouseenter', this.callbackOnMouseEnter, false);
      element.addEventListener('mouseleave', this.callbackOnMouseLeave, false);
    });
  }

  private removeEventListeners(element: Element) {
    element.removeEventListener('mouseenter', this.callbackOnMouseEnter, false);
    element.removeEventListener('mouseleave', this.callbackOnMouseLeave, false);
  }
}
