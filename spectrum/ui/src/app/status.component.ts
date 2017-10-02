import { Component, Input } from '@angular/core';

@Component({
  selector: 'psm-status',
  template: `
    <div [ngClass]="{status: true, error: s.error != undefined}">
      <h2>{{label}} <ng-container *ngIf="s.timestamp">at {{s.timestamp | date}}</ng-container></h2>
      <div *ngIf="s.sweep">
        <span>Scan {{s.sweep.sweep_n + 1}} started at {{s.sweep.timestamp | date}}</span>
        <span *ngFor="let peak of s.sweep.peaks || []">Peak {{peak.strength}}dB at {{peak.freq_n | freq:values}}</span>
        <span *ngIf="s.sweep.previous">{{s.sweep.previous.strength}}dB at {{s.sweep.previous.freq_n | freq:values}}</span>
        <span *ngIf="s.sweep.current">Reading strength at {{s.sweep.current.freq_n | freq:values}}...</span>
        <span *ngIf="s.sweep.record">Recording audio sample at {{s.sweep.record.freq_n | freq:values}}...</span>
        <span *ngIf="s.sweep.freq_0 != undefined">Current range {{s.sweep.freq_0}} - {{s.sweep.freq_1}} MHz</span>
        <span *ngIf="s.sweep.max != undefined">Max strength {{s.sweep.max}}</span>
      </div>
      <span *ngIf="s.freq_n != undefined">Receiving on {{s.freq_n | freq:values}}</span>
      <span *ngIf="s.strength != undefined">Strength: {{s.strength}}</span>
      <span *ngIf="s.name">Station name: {{s.name}}</span>
      <span *ngIf="s.text"><i>{{s.text}}</i></span>
      <span *ngIf="s.error">{{s.error}}</span>
    </div>`
})
export class StatusComponent {
  @Input() label: string;
  @Input('status') s: any;
  @Input() values: any;
}
