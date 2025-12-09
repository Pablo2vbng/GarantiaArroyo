// Declarar variables de vistas y estado en un ámbito accesible
const formContainer = document.getElementById('formContainer');
const loadingContainer = document.getElementById('loadingContainer');
const confirmationContainer = document.getElementById('confirmationContainer');
const form = document.getElementById('reclamacionForm');
const viewPdfButton = document.getElementById('viewPdfButton');

let formFields;
let generatedPdfBlobUrl = null; 
let generatedPdfFileName = "Reclamacion.pdf"; 

document.addEventListener('DOMContentLoaded', () => {
    // Verificar que jsPDF está cargado
    if (!window.jspdf) {
        alert("Error CRÍTICO: La librería jsPDF no se ha cargado correctamente. Verifica tu conexión a internet o el archivo HTML.");
        return;
    }

    formFields = form.querySelectorAll('input[type="text"], input[type="date"], input[type="tel"], textarea');

    // Lógica para guardar y cargar datos
    const saveData = () => formFields.forEach(field => localStorage.setItem(field.id, field.value));
    const loadData = () => {
        formFields.forEach(field => {
            const savedValue = localStorage.getItem(field.id);
            if (savedValue) field.value = savedValue;
        });
    };
    formFields.forEach(field => field.addEventListener('input', saveData));
    loadData();

    // Feedback de archivos
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const successMessage = event.target.closest('.input-ejemplo').querySelector('.upload-success-message');
            successMessage.style.display = event.target.files.length > 0 ? 'inline' : 'none';
        });
    });

    // Reset
    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        formFields.forEach(field => localStorage.removeItem(field.id));
        window.location.reload();
    });
});

// Event listener envío
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log("Iniciando proceso de generación..."); // Log para depuración
    
    // Vista Cargando
    formContainer.style.display = 'none';
    loadingContainer.style.display = 'block';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Nombre del archivo
    let fechaStr = "00-00-00";
    if(data.fecha) {
        const parts = data.fecha.split('-'); 
        if(parts.length === 3) {
            fechaStr = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
        }
    }
    const empresaLimpia = (data.empresa || '').replace(/[^a-zA-Z0-9]/g, '');
    const facturaStr = (data.factura || '').replace(/[^a-zA-Z0-9]/g, '');
    generatedPdfFileName = `Garantia-${empresaLimpia}-${facturaStr}-${fechaStr}.pdf`;

    try {
        // 1. Procesar imágenes subidas
        console.log("Procesando imágenes subidas...");
        const images = await getImagesAsBase64();
        
        // 2. Generar PDF
        console.log("Generando PDF...");
        const pdfBlob = await generatePdfBlob(data, images, generatedPdfFileName);
        
        generatedPdfBlobUrl = URL.createObjectURL(pdfBlob); 

        // 3. Configurar mailto
        const mailtoLink = document.getElementById('mailtoLink');
        const subject = `Nueva Reclamación de: ${data.empresa} - Factura: ${data.factura || 'N/A'}`;
        const body = `Hola,\n\nHas recibido una nueva reclamación de la empresa: ${data.empresa}.\nPersona de contacto: ${data.contacto}.\n\nTodos los detalles y las imágenes están en el archivo PDF adjunto (${generatedPdfFileName}).\n\nSaludos.`;
        mailtoLink.href = `mailto:nacho@representacionesarroyo.es,paloma@representacionesarroyo.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Éxito
        loadingContainer.style.display = 'none';
        confirmationContainer.style.display = 'block';

    } catch (error) {
        console.error("Error en el proceso:", error);
        alert("Ocurrió un error al crear el PDF: " + error.message);
        loadingContainer.style.display = 'none';
        formContainer.style.display = 'block';
    }
});

viewPdfButton.addEventListener('click', () => {
    if (generatedPdfBlobUrl) {
        const link = document.createElement('a');
        link.href = generatedPdfBlobUrl;
        link.download = generatedPdfFileName; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        formFields.forEach(field => localStorage.removeItem(field.id));
    } else {
        alert("Error: No se ha generado ningún PDF.");
    }
});

// --- FUNCIONES AUXILIARES ---

function getImagesAsBase64() {
    const fileInputs = [
        document.getElementById('fotoDelantera'), document.getElementById('fotoTrasera'),
        document.getElementById('fotoDetalleDefecto'), document.getElementById('fotoEtiqueta')
    ];
    const filePromises = fileInputs.map(input => {
        return new Promise((resolve, reject) => {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(input.files[0]);
            } else {
                // Mensaje más amigable
                reject(new Error(`Falta la imagen: ${input.parentNode.parentNode.querySelector('label').innerText}`));
            }
        });
    });
    return Promise.all(filePromises).then(([delantera, trasera, detalle, etiqueta]) => ({ delantera, trasera, detalle, etiqueta }));
}

async function generatePdfBlob(data, images, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setProperties({ title: fileName });

    const pageWidth = doc.internal.pageSize.getWidth(); 
    const margin = 12; 

    // Colores
    const headerBgColor = [253, 248, 235]; 
    const labelBgColor = [230, 230, 230];  
    const redColor = [255, 0, 0];          

    // --- 1. CABECERA ---
    doc.setFillColor(...headerBgColor);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Intentar cargar logo (con protección contra fallos)
    try {
        const logoUrl = 'img/upower.png';
        // Verificar primero si existe (fetch simple)
        const response = await fetch(logoUrl);
        if (response.ok) {
            const logoBlob = await response.blob();
            const logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(logoBlob);
            });
            // Logo Izquierdo
            doc.addImage(logoBase64, 'PNG', margin, 8, 30, 12);
            // Logo Derecho
            doc.addImage(logoBase64, 'PNG', pageWidth - margin - 30, 8, 30, 12);
        } else {
            console.warn("La imagen del logo no se encontró (404). Se generará sin logo.");
        }
    } catch (e) {
        console.warn("Error cargando el logo (puede ser CORS o ruta):", e);
        // Continuamos sin logo, no lanzamos error
    }

    // Título
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...redColor);
    doc.text('RECLAMACION DE GARANTÍAS', pageWidth / 2, 18, { align: 'center' });

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);

    // --- 2. CAMPOS DE DATOS ---
    let y = 45;
    const colGap = 10;
    const contentWidth = pageWidth - (margin * 2);
    const colWidth = (contentWidth - colGap) / 2; 
    
    const rowHeight = 8;
    const labelWidth = 25; 
    const valueWidth = colWidth - labelWidth;

    const drawRow = (label, value, xStart, yPos) => {
        doc.setFillColor(...labelBgColor);
        doc.rect(xStart, yPos, labelWidth, rowHeight, 'FD'); 
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(label, xStart + 2, yPos + 5.5);

        doc.setFillColor(255, 255, 255);
        doc.rect(xStart + labelWidth, yPos, valueWidth, rowHeight, 'FD');

        doc.setFont('Helvetica', 'normal');
        doc.text(String(value || '').toUpperCase(), xStart + labelWidth + 2, yPos + 5.5);
    };

    const leftColX = margin;
    const rightColX = margin + colWidth + colGap;

    // Fila 1
    drawRow('FECHA', data.fecha, leftColX, y);
    drawRow('AGENTE', 'Representaciones Arroyo', rightColX, y);
    y += rowHeight + 2;

    // Fila 2
    drawRow('CLIENTE', data.empresa, leftColX, y);
    drawRow('CONTACTO', data.contacto, rightColX, y);
    
    y += rowHeight + 8; 

    // Sección Detalles
    const startYSection2 = y;
    
    drawRow('MODELO', data.modelo, leftColX, y);
    y += rowHeight + 2;
    drawRow('REF', data.referencia, leftColX, y);
    y += rowHeight + 2;
    drawRow('TALLA', data.talla, leftColX, y);

    // Caja Derecha
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DESCRIPCIÓN DEFECTO', rightColX, startYSection2 - 1); 
    
    const descBoxHeight = (rowHeight * 3) + 4; 
    doc.setDrawColor(0);
    doc.setFillColor(255, 255, 255);
    doc.rect(rightColX, startYSection2, colWidth, descBoxHeight, 'S'); 
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    const splitDesc = doc.splitTextToSize(data.defecto, colWidth - 4);
    doc.text(splitDesc, rightColX + 2, startYSection2 + 5);

    y = startYSection2 + descBoxHeight + 10; 

    // --- 3. FOTOGRAFÍAS ---
    const photoBoxHeight = 160; 
    const photoBoxY = y;
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(100, 100, 100); 
    doc.text('INSERTAR FOTOGRAFÍAS', pageWidth / 2, photoBoxY - 3, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.rect(margin, photoBoxY, contentWidth, photoBoxHeight, 'S');

    const pPad = 5;
    const gridW = (contentWidth - (pPad * 3)) / 2;
    const gridH = (photoBoxHeight - (pPad * 3)) / 2;

    const x1 = margin + pPad;
    const x2 = margin + pPad + gridW + pPad;
    const y1 = photoBoxY + pPad;
    const y2 = photoBoxY + pPad + gridH + pPad;

    // Añadir fotos
    if (images.delantera) doc.addImage(images.delantera, 'JPEG', x1, y1, gridW, gridH, undefined, 'FAST');
    if (images.etiqueta) doc.addImage(images.etiqueta, 'JPEG', x2, y1, gridW, gridH, undefined, 'FAST');
    if (images.detalle) doc.addImage(images.detalle, 'JPEG', x1, y2, gridW, gridH, undefined, 'FAST');
    if (images.trasera) doc.addImage(images.trasera, 'JPEG', x2, y2, gridW, gridH, undefined, 'FAST');

    return doc.output('blob');
}
