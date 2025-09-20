import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
    standalone:true,
  imports:[CommonModule],
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Input() templateName!: string;
  @Output() templateNameChange = new EventEmitter<string>();
  @Output() saveTemplate = new EventEmitter<void>();
  @Output() clearCanvas = new EventEmitter<void>();
  @Output() exportTemplate = new EventEmitter<void>();
  @Output() importTemplate = new EventEmitter<void>();
}