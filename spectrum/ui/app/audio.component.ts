import { Component, Input, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-audio',
  templateUrl: 'templates/audio.html',
  directives: [ WidgetComponent ]
})
export class AudioComponent {
  audio: any = { };

  @ViewChild(WidgetComponent) widgetComponent;
  @ViewChild('form') form;

  constructor(private dataService: DataService) { }

  ngOnInit() {
    this.onReset();
  }

  onReset() {
    this.widgetComponent.busy(this.dataService.getAudio())
                        .subscribe(audio => this.audio = audio);
    if (this.form) this.widgetComponent.pristine(this.form);
  }

  onSubmit() {
    this.widgetComponent.busy(this.dataService.setAudio(this.audio))
                        .subscribe();
    this.widgetComponent.pristine(this.form);
  }

  get loading() {
    return this.widgetComponent.loading;
  }
}
