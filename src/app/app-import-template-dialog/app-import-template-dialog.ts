import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-import-template-dialog',
  templateUrl: './app-import-template-dialog.html',
    standalone:true,
  imports:[CommonModule,FormsModule],
  styleUrls: ['./app-import-template-dialog.scss']
})
export class ImportTemplateDialogComponent {
  selectedFile: File | null = null;
  @Input() jsonPreview!: string;
  @Output() importConfirmed = new EventEmitter<any>(); // emit imported data
  @Output() cancel = new EventEmitter<void>();

  downloadSample() {
  let headerLabels: string[] = [];

  try {
    if (this.jsonPreview) {
      const jsonObject = JSON.parse(this.jsonPreview);

      // Get all keys except 'timestamp'
      headerLabels = Object.keys(jsonObject).filter(key => key !== 'timestamp');
    }
  } catch (e) {
    console.warn('Failed to parse jsonPreview:', e);
    headerLabels = [];
  }

  const fileName = 'SampleTemplate.xlsx';

  const ws = XLSX.utils.aoa_to_sheet([headerLabels]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, fileName);
}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    } else {
      this.selectedFile = null;
    }
  }

  confirmImport() {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      this.importConfirmed.emit(jsonData);
      this.close();
    };

    reader.onerror = () => {
      alert('Failed to read file!');
      this.close();
    };

    reader.readAsArrayBuffer(this.selectedFile);
  }

  close() {
    this.cancel.emit();
  }
}