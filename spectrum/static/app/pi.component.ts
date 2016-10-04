import { Component, ViewChild } from '@angular/core';
import { DataService } from './data.service';
import { WidgetComponent } from './widget.component';

@Component({
  selector: 'psm-pi',
  directives: [ WidgetComponent ],
  template: `<psm-widget title="Pi Controls">
               <form role="form">
                 <div class="form-group">
                   <button class="btn btn-default" (click)="onCommand('reboot')">Reboot</button>
                   <button class="btn btn-default" (click)="onCommand('shutdown')">Shutdown</button>
                 </div>
               </form>
             </psm-widget>`
})
export class PiComponent {

  constructor(private dataService: DataService) {}

  onCommand(command: string) {
    this.dataService.piCommand(command).subscribe();
  }

}
