import { Injectable, signal, WritableSignal } from '@angular/core';
import { Template, Widget } from '../models/template.model';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
declare var JsBarcode: any;

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly STORAGE_KEY = 'templates';
  public widgets: WritableSignal<Widget[]> = signal<Widget[]>([]);
  getTemplates(): Template[] {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  saveTemplate(template: Template): Template[] {
    const templates = this.getTemplates();
    templates.push(template);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    return templates;
  }

  deleteTemplate(templateId: number): Template[] {
    const templates = this.getTemplates();
    const filteredTemplates = templates.filter((t) => t.id !== templateId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredTemplates));
    return filteredTemplates;
  }

  // exportTemplate(template: Template, templateName: string) {
  //   const dataStr = JSON.stringify(template, null, 2);
  //   const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  //   const exportFileDefaultName = templateName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_template.json';

  //   const linkElement = document.createElement('a');
  //   linkElement.setAttribute('href', dataUri);
  //   linkElement.setAttribute('download', exportFileDefaultName);
  //   linkElement.click();
  // }

  exportTemplate(templateName: string) {
    const element = document.getElementById('canvas-container');

    if (!element) {
      console.error('Template canvas not found');
      return;
    }

    html2canvas(element).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'p', // portrait
        unit: 'pt', // points
        format: 'a4', // page size
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let position = 0;

      // If content height is bigger than one page, split into multiple pages
      if (imgHeight > pageHeight) {
        let heightLeft = imgHeight;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      }

      const exportFileDefaultName =
        templateName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_template.pdf';

      pdf.save(exportFileDefaultName);
    });
  }

  getTemplateById(templateId: number): Template {
    const templates = this.getTemplates();
    const template = templates.find((t) => t.id === templateId);
    return template || ({} as Template);
  }

  async exportMultipleTemplatesWithProducts(
    template: Template,
    products: any[],
    templateName: string
  ) {
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Clone the template deeply to modify safely
      const clonedTemplate: Template = JSON.parse(JSON.stringify(template));

      // Map product data to template widgets
      clonedTemplate.widgets.forEach((widget) => {
        if (widget.type === 'labeled-input' && widget.labelText) {
          // Map labelled-input widget inputValue from product JSON by labelName
          if (product.hasOwnProperty(widget.labelText)) {
            widget.inputValue = product[widget.labelText];
          }
        }

        if (widget.type === 'image') {
          // Map images by headers like image1, image2, etc.
          // Check for imageName property or use a pattern
          const imageKey = widget.imageName || `image${widget.id}` || `image${i + 1}`;
          if (product.hasOwnProperty(imageKey)) {
            widget.imageData = product[imageKey];
          }
        }

        if (widget.type === 'barcode') {
          // Set barcode content from productId field
          if (product.productId) {
            widget.productId = product.productId;
            widget.hasBarcode = true;
          }
        }
      });

      // Create a temporary canvas container for this specific product
      const canvas = await this.createTemporaryCanvas(clonedTemplate.widgets);
      const imgData = canvas.toDataURL('image/png');

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }

      // Handle content that might exceed page height
      if (imgHeight > pageHeight) {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }
    }

    // Save/download the pdf file
    const exportFileDefaultName =
      templateName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_products.pdf';
    pdf.save(exportFileDefaultName);
  }

  private async createTemporaryCanvas(widgets: Widget[]): Promise<HTMLCanvasElement> {
    // Create a temporary container
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '800px';
    tempContainer.style.minHeight = '600px';
    tempContainer.style.background = 'white';
    tempContainer.style.border = '2px dashed #cbd5e0';
    tempContainer.style.borderRadius = '10px';
    tempContainer.style.padding = '20px';

    // Create widgets HTML
    widgets.forEach((widget) => {
      const widgetElement = this.createWidgetElement(widget);
      tempContainer.appendChild(widgetElement);
    });

    // Append to body temporarily
    document.body.appendChild(tempContainer);

    try {
      // Capture the canvas
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: 'white',
        scale: 1,
        logging: false,
      });

      return canvas;
    } finally {
      // Clean up
      document.body.removeChild(tempContainer);
    }
  }

  private createWidgetElement(widget: Widget): HTMLElement {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.left = `${widget.left}px`;
    element.style.top = `${widget.top}px`;
    element.style.width = `${widget.width}px`;
    if (typeof widget.height === 'number') {
      element.style.height = `${widget.height}px`;
    }
    element.style.fontSize = widget.fontSize || '14px';
    element.style.fontWeight = widget.fontWeight || 'normal';
    element.style.padding = '5px';
    element.style.minWidth = '100px';
    element.style.transition = 'all 0.2s ease';

    switch (widget.type) {
      case 'labeled-input':
        // Create container with proper positioning
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';

        // Apply positioning class logic
        const labelPosition = widget.labelPosition || 'left';
        switch (labelPosition) {
          case 'top':
            container.style.flexDirection = 'column';
            container.style.alignItems = 'flex-start';
            break;
          case 'bottom':
            container.style.flexDirection = 'column-reverse';
            container.style.alignItems = 'flex-start';
            break;
          case 'left':
            container.style.flexDirection = 'row';
            break;
          case 'right':
            container.style.flexDirection = 'row-reverse';
            break;
        }

        // Create label if not hidden
        if (!widget.hideLabel && widget.labelText) {
          const label = document.createElement('div');
          label.textContent = widget.labelText;
          label.style.fontWeight = 'bold';
          label.style.color = '#2d3748';
          label.style.padding = '5px';
          label.style.display = 'inline-block';
          container.appendChild(label);
        }

        // Create input field
        const input = document.createElement('div');
        input.textContent = widget.inputValue || '';
        input.style.padding = '8px';
        input.style.border = '1px solid #cbd5e0';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        input.style.background = 'white';
        input.style.width = '100%';
        input.style.minHeight = '20px';
        input.style.wordWrap = 'break-word';
        container.appendChild(input);

        element.appendChild(container);
        break;

      case 'separator':
        const separator = document.createElement('div');
        separator.style.width = '100%';
        separator.style.height = '2px';
        separator.style.background = '#cbd5e0';
        separator.style.margin = '10px 0';
        element.appendChild(separator);
        break;

      case 'image':
        element.style.padding = '20px';
        element.style.borderRadius = '4px';
        element.style.textAlign = 'center';
        element.style.minHeight = '120px';
        element.style.display = 'flex';
        element.style.flexDirection = 'column';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = '#718096';

        if (widget.imageData) {
          // Remove border when image is present
          element.style.border = 'none';
          const img = document.createElement('img');
          img.src = widget.imageData;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '200px';
          img.style.objectFit = 'contain';
          img.style.borderRadius = '4px';
          element.appendChild(img);
        } else {
          element.style.border = '2px dashed #cbd5e0';
          element.textContent = '🖼️ Image Placeholder';
        }
        break;

      case 'barcode':
        element.style.background = '#f7fafc';
        element.style.padding = '10px';
        element.style.borderRadius = '4px';
        element.style.textAlign = 'center';
        element.style.minHeight = '80px';
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
        element.style.color = '#718096';
        element.style.flexDirection = 'column';

        if (widget.hasBarcode && widget.productId) {
          // Remove border when barcode is present
          element.style.border = 'none';

          // Generate actual barcode using canvas
          const barcodeCanvas = this.generateBarcodeCanvas(widget.productId);
          if (barcodeCanvas) {
            const barcodeImg = document.createElement('img');
            barcodeImg.src = barcodeCanvas.toDataURL();
            barcodeImg.style.maxWidth = '100%';
            barcodeImg.style.height = 'auto';
            element.appendChild(barcodeImg);
          } else {
            // Fallback to CSS barcode if canvas generation fails
            const barcodeContainer = document.createElement('div');
            barcodeContainer.style.display = 'flex';
            barcodeContainer.style.flexDirection = 'column';
            barcodeContainer.style.alignItems = 'center';

            const barcode = document.createElement('div');
            barcode.style.background =
              'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)';
            barcode.style.height = '50px';
            barcode.style.width = '150px';
            barcode.style.marginBottom = '5px';
            barcodeContainer.appendChild(barcode);

            const productIdText = document.createElement('div');
            productIdText.textContent = widget.productId;
            productIdText.style.textAlign = 'center';
            productIdText.style.fontSize = '12px';
            productIdText.style.color = '#000';
            barcodeContainer.appendChild(productIdText);

            element.appendChild(barcodeContainer);
          }
        } else {
          element.style.border = '2px dashed #cbd5e0';
          element.textContent = '📊 Barcode Placeholder';
        }
        break;

      default:
        element.textContent = widget.content || '';
        break;
    }

    return element;
  }
  private generateBarcodeCanvas(productId: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    try {
      // Check if JsBarcode is available
      if (!(window as any).JsBarcode) {
        console.warn('JsBarcode library not found. Make sure it is loaded.');
      }

      // Create a temporary canvas
      canvas.width = 300;
      canvas.height = 100;

      // Generate barcode
      (window as any).JsBarcode(canvas, productId, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return canvas;
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
    return canvas;
  }
}
