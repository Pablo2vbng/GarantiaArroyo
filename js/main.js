document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado. Iniciando script...");

    // 1. Referencias a elementos del DOM (Buscamos todo aquí dentro para asegurar que existen)
    const formContainer = document.getElementById('formContainer');
    const loadingContainer = document.getElementById('loadingContainer');
    const confirmationContainer = document.getElementById('confirmationContainer');
    const form = document.getElementById('reclamacionForm');
    const viewPdfButton = document.getElementById('viewPdfButton');
    const resetButton = document.getElementById('resetButton');

    // Variables de estado
    let generatedPdfBlobUrl = null; 
    let generatedPdfFileName = "Reclamacion.pdf"; 

    // VERIFICACIÓN DE SEGURIDAD
    if (!form) {
        console.error("ERROR CRÍTICO: No se encontró el formulario con id='reclamacionForm'");
        alert("Error: No se encuentra el formulario. Revisa que el HTML tenga id='reclamacionForm'");
        return;
    }

    if (!window.jspdf) {
        console.error("ERROR CRÍTICO: jsPDF no está cargado.");
        alert("Error: La librería jsPDF no se cargó. Revisa tu conexión a internet.");
        return;
    }

    // 2. Guardado automático de datos (LocalStorage)
    const formFields = form.querySelectorAll('input[type="text"], input[type="date"], input[type="tel"], textarea');
    
    const saveData = () => formFields.forEach(field => localStorage.setItem(field.id, field.value));
    const loadData = () => {
        formFields.forEach(field => {
            const savedValue = localStorage.getItem(field.id);
            if (savedValue) field.value = savedValue;
        });
    };
    
    formFields.forEach(field => field.addEventListener('input', saveData));
    loadData();

    // 3. Feedback visual para input file
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const container = event.target.closest('.input-ejemplo');
            if (container) {
                const successMessage = container.querySelector('.upload-success-message');
                if (successMessage) {
                    successMessage.style.display = event.target.files.length > 0 ? 'inline' : 'none';
                }
            }
        });
    });

    // 4. Botón Reset
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            formFields.forEach(field => localStorage.removeItem(field.id));
            window.location.reload();
        });
    }

    // 5. Botón Ver PDF (Confirmación)
    if (viewPdfButton) {
        viewPdfButton.addEventListener('click', () => {
            if (generatedPdfBlobUrl) {
                const link = document.createElement('a');
                link.href = generatedPdfBlobUrl;
                link.download = generatedPdfFileName; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // Limpiar datos
                formFields.forEach(field => localStorage.removeItem(field.id));
            } else {
                alert("Error: No se ha generado ningún PDF.");
            }
        });
    }

    // ==========================================
    // 6. LÓGICA PRINCIPAL: ENVÍO DEL FORMULARIO
    // ==========================================
    form.addEventListener('submit', async (event) => {
        // PASO CLAVE: Evitar recarga
        event.preventDefault(); 
        console.log("Formulario enviado. Procesando...");

        try {
            // Cambiar vista a cargando
            if (formContainer) formContainer.style.display = 'none';
            if (loadingContainer) loadingContainer.style.display = 'block';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Generar nombre archivo
            let fechaStr = "00-00-00";
            if(data.fecha) {
                const parts = data.fecha.split('-'); 
                if(parts.length === 3) fechaStr = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
            }
            const empresaLimpia = (data.empresa || '').replace(/[^a-zA-Z0-9]/g, '');
            const facturaStr = (data.factura || '').replace(/[^a-zA-Z0-9]/g, '');
            generatedPdfFileName = `Garantia-${empresaLimpia}-${facturaStr}-${fechaStr}.pdf`;

            // Procesar imágenes y PDF
            const images = await getImagesAsBase64();
            const pdfBlob = await generatePdfBlob(data, images, generatedPdfFileName);
            
            generatedPdfBlobUrl = URL.createObjectURL(pdfBlob); 

            // Configurar mailto
            const mailtoLink = document.getElementById('mailtoLink');
            if (mailtoLink) {
                const subject = `Nueva Reclamación de: ${data.empresa} - Factura: ${data.factura || 'N/A'}`;
                const body = `Hola,\n\nHas recibido una nueva reclamación de la empresa: ${data.empresa}.\nPersona de contacto: ${data.contacto}.\n\nTodos los detalles y las imágenes están en el archivo PDF adjunto (${generatedPdfFileName}).\n\nSaludos.`;
                mailtoLink.href = `mailto:nacho@representacionesarroyo.es,paloma@representacionesarroyo.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }

            // Mostrar confirmación
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (confirmationContainer) confirmationContainer.style.display = 'block';

        } catch (error) {
            console.error("Error capturado:", error);
            alert("Ocurrió un error: " + error.message);
            // Restaurar vista
            if (loadingContainer) loadingContainer.style.display = 'none';
            if (formContainer) formContainer.style.display = 'block';
        }
    });
});

// --- FUNCIONES AUXILIARES (Fuera del evento para limpieza) ---

function getImagesAsBase64() {
    const ids = ['fotoDelantera', 'fotoTrasera', 'fotoDetalleDefecto', 'fotoEtiqueta'];
    
    const filePromises = ids.map(id => {
        return new Promise((resolve, reject) => {
            const input = document.getElementById(id);
            if (!input) {
                reject(new Error(`No se encuentra el input con ID: ${id}`));
                return;
            }
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(input.files[0]);
            } else {
                reject(new Error(`Falta seleccionar la imagen del campo: ${id}`));
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
    const headerBgColor = [253, 248, 235]; 
    const labelBgColor = [230, 230, 230];  
    const redColor = [255, 0, 0];          

    // --- CABECERA ---
    doc.setFillColor(...headerBgColor);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Logo
    try {
        const logoUrl = 'img/upower.png';
        const response = await fetch(logoUrl);
        if (response.ok) {
            const logoBlob = await response.blob();
            const logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(logoBlob);
            });
            doc.addImage(logoBase64, 'PNG', margin, 8, 30, 12);
            doc.addImage(logoBase64, 'PNG', pageWidth - margin - 30, 8, 30, 12);
        }
    } catch (e) { console.warn("Logo no cargado", e); }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...redColor);
    doc.text('RECLAMACION DE GARANTÍAS', pageWidth / 2, 18, { align: 'center' });
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);

    // --- DATOS ---
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

    drawRow('FECHA', data.fecha, leftColX, y);
    drawRow('AGENTE', 'Representaciones Arroyo', rightColX, y);
    y += rowHeight + 2;

    drawRow('CLIENTE', data.empresa, leftColX, y);
    drawRow('CONTACTO', data.contacto, rightColX, y);
    y += rowHeight + 8; 

    const startYSection2 = y;
    drawRow('MODELO', data.modelo, leftColX, y);
    y += rowHeight + 2;
    drawRow('REF', data.referencia, leftColX, y);
    y += rowHeight + 2;
    drawRow('TALLA', data.talla, leftColX, y);

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

    // --- FOTOS ---
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

    if (images.delantera) doc.addImage(images.delantera, 'JPEG', x1, y1, gridW, gridH, undefined, 'FAST');
    if (images.etiqueta) doc.addImage(images.etiqueta, 'JPEG', x2, y1, gridW, gridH, undefined, 'FAST');
    if (images.detalle) doc.addImage(images.detalle, 'JPEG', x1, y2, gridW, gridH, undefined, 'FAST');
    if (images.trasera) doc.addImage(images.trasera, 'JPEG', x2, y2, gridW, gridH, undefined, 'FAST');

    return doc.output('blob');
}
