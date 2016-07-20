import { Component, ContentChild, Input, Renderer } from '@angular/core';

@Component({
  selector: 'psm-input',
  template: '<div tabindex=0 *ngIf="! editing" (focus)="onFocus()">{{getValue()}}</div><div *ngIf="editing"><ng-content></ng-content></div>',
  styles: [ 'div::before{ content: "\\200B"; }' ]
})
export class InputComponent {
  editing: boolean = false;
  listenFns: Function[] = [];

  @Input() disabled: boolean;
  @ContentChild('input') input;

  constructor(private renderer : Renderer) { }

  ngOnInit() {
    this.listenFns.push(this.renderer.listen(this.input.nativeElement, 'blur', (event) => {
      this.editing = false;
    }));
    this.listenFns.push(this.renderer.listen(this.input.nativeElement, 'keypress', (event) => {
      if (event.keyCode == 13) {
        this.input.nativeElement.blur(); // setting 'editing' directly is a bug here
      }
    }));
  }

  ngOnDestroy() {
    for (var fn of this.listenFns) {
      fn();
    }
  }

  onFocus() {
    if (this.disabled) return;
    setTimeout(function () { this.input.nativeElement.focus() }.bind(this));
    this.editing = true;
  }

  getValue() {
    if (this.input.nativeElement.nodeName == 'SELECT') {
      let options = this.input.nativeElement.selectedOptions;
      return options.length > 0 ? options[0].label : undefined;
    }
    return this.input.nativeElement.value;
  }
}
