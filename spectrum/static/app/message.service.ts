import { Injectable } from '@angular/core';

declare var $;

@Injectable()
export class MessageService {
  public show(message: string) {
    $("#messageModal h4").text(message);
    $("#messageModal").modal();
  }
}
