// Declarar variables de vistas y estado en un ámbito accesible
const formContainer = document.getElementById('formContainer');
const loadingContainer = document.getElementById('loadingContainer');
const confirmationContainer = document.getElementById('confirmationContainer');
const form = document.getElementById('reclamacionForm');
const viewPdfButton = document.getElementById('viewPdfButton');

let formFields;
let generatedPdfBlobUrl = null; // Guardaremos la URL del PDF aquí
let generatedPdfFileName = "Reclamacion.pdf"; // Variable para guardar el nombre personalizado

document.addEventListener('DOMContentLoaded', () => {
    // Asignar formFields una vez que el DOM está listo
    formFields = form.querySelectorAll('input[type="text"], input[type="date"], input[type="tel"], textarea');

    // Lógica para guardar y cargar datos del formulario en localStorage
    const saveData = () => formFields.forEach(field => localStorage.setItem(field.id, field.value));
    const loadData = () => {
        formFields.forEach(field => {
            const savedValue = localStorage.getItem(field.id);
            if (savedValue) field.value = savedValue;
        });
    };
    formFields.forEach(field => field.addEventListener('input', saveData));
    loadData();

    // Lógica para mostrar feedback de subida de archivos
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const successMessage = event.target.closest('.input-ejemplo').querySelector('.upload-success-message');
            successMessage.style.display = event.target.files.length > 0 ? 'inline' : 'none';
        });
    });

    // Botón para crear una nueva reclamación
    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
        formFields.forEach(field => localStorage.removeItem(field.id));
        window.location.reload();
    });
});

// Event listener para el envío del formulario
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Cambiar a la vista de "Cargando"
    formContainer.style.display = 'none';
    loadingContainer.style.display = 'block';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // --- LÓGICA DE NOMBRE DEL ARCHIVO ---
    let fechaStr = "00-00-00";
    if(data.fecha) {
        const parts = data.fecha.split('-'); // [2025, 12, 09]
        if(parts.length === 3) {
            fechaStr = `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
        }
    }

    const empresaLimpia = (data.empresa || '').replace(/[^a-zA-Z0-9]/g, '');
    const facturaStr = (data.factura || '').replace(/[^a-zA-Z0-9]/g, '');

    generatedPdfFileName = `Garantia-${empresaLimpia}-${facturaStr}-${fechaStr}.pdf`;
    // -------------------------------------

    try {
        const images = await getImagesAsBase64();
        // Pasamos el nombre del archivo a la función generadora para los metadatos
        const pdfBlob = await generatePdfBlob(data, images, generatedPdfFileName);
        generatedPdfBlobUrl = URL.createObjectURL(pdfBlob); // Guardar la URL del blob

        // Configurar el enlace de correo
        const mailtoLink = document.getElementById('mailtoLink');
        const subject = `Nueva Reclamación de: ${data.empresa} - Factura: ${data.factura || 'N/A'}`;
        const body = `Hola,\n\nHas recibido una nueva reclamación de la empresa: ${data.empresa}.\nPersona de contacto: ${data.contacto}.\n\nTodos los detalles y las imágenes están en el archivo PDF adjunto (${generatedPdfFileName}).\n\nSaludos.`;
        mailtoLink.href = `mailto:nacho@representacionesarroyo.es,paloma@representacionesarroyo.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Cambiar a la vista de "Confirmación"
        loadingContainer.style.display = 'none';
        confirmationContainer.style.display = 'block';

    } catch (error) {
        alert(error.message || 'Hubo un problema al generar el PDF.');
        console.error(error);
        // Volver a la vista del formulario si hay un error
        loadingContainer.style.display = 'none';
        formContainer.style.display = 'block';
    }
});

// Event listener para el botón "Ver y Guardar PDF"
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
                reject(new Error(`La imagen "${input.labels[0].textContent}" es obligatoria.`));
            }
        });
    });
    return Promise.all(filePromises).then(([delantera, trasera, detalle, etiqueta]) => ({ delantera, trasera, detalle, etiqueta }));
}

// ESTA ES LA FUNCIÓN QUE CAMBIA LA APARIENCIA DEL PDF
async function generatePdfBlob(data, images, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setProperties({ title: fileName });

    // Dimensiones y márgenes
    const pageWidth = doc.internal.pageSize.getWidth(); // 210
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // Colores del diseño
    const colorBeige = [253, 248, 235];
    const colorRojo = [237, 28, 36]; // Rojo U-Power aproximado
    const colorGrisEtiqueta = [240, 240, 240];

    // --- 1. CABECERA (Fondo Beige) ---
    doc.setFillColor(...colorBeige);
    doc.rect(0, 0, pageWidth, 35, 'F'); // Rectángulo fondo cabecera

    // Logos y Título
    try {
        const upowerLogoBase64 = await imageToBase64('img/upower.png');
        // Logo Izquierdo
        doc.addImage(upowerLogoBase64, 'PNG', margin, 6, 28, 10);
        // Logo Derecho
        doc.addImage(upowerLogoBase64, 'PNG', pageWidth - margin - 28, 6, 28, 10);
    } catch (logoError) {
        console.warn('Logo de U-Power no encontrado, continuando sin logos.', logoError);
    }

    doc.setFontSize(16).setFont('Helvetica', 'bold').setTextColor(...colorRojo);
    doc.text('RECLAMACION DE GARANTÍAS', pageWidth / 2, 14, { align: 'center' });

    // Línea separadora negra fina
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);

    // --- 2. CAMPOS DE DATOS (Estilo Tabla) ---
    let y = 45;
    const rowHeight = 8;
    const gap = 5;
    const halfWidth = (contentWidth - gap) / 2;
    const labelWidth = 25;
    const valWidth = halfWidth - labelWidth;

    // Función para dibujar una "celda" estilo formulario (Gris | Blanco)
    const drawFormRow = (lbl, val, x, currentY) => {
        // Etiqueta (Gris con borde)
        doc.setFillColor(...colorGrisEtiqueta);
        doc.rect(x, currentY, labelWidth, rowHeight, 'FD');
        doc.setFontSize(9).setFont('Helvetica', 'bold').setTextColor(0);
        doc.text(lbl, x + 1, currentY + 5.5);

        // Valor (Blanco con borde)
        doc.setFillColor(255, 255, 255);
        doc.rect(x + labelWidth, currentY, valWidth, rowHeight, 'FD');
        doc.setFontSize(9).setFont('Helvetica', 'normal');
        doc.text(String(val || '').toUpperCase(), x + labelWidth + 2, currentY + 5.5);
    };

    // Fila 1: FECHA y AGENTE
    drawFormRow('FECHA', data.fecha, margin, y);
    drawFormRow('AGENTE', 'Representaciones Arroyo', margin + halfWidth + gap, y);
    y += rowHeight + 2;

    // Fila 2: CLIENTE y CONTACTO
    drawFormRow('CLIENTE', data.empresa, margin, y);
    drawFormRow('CONTACTO', data.contacto, margin + halfWidth + gap, y);
    y += rowHeight + 8; // Espacio extra antes de la siguiente sección

    // Fila 3: MODELO (Izq) y Descripción (Inicio Der)
    const yStartDetails = y;
    
    // Columna Izquierda (Modelo, Ref, Talla)
    drawFormRow('MODELO', data.modelo, margin, y);
    y += rowHeight + 2;
    drawFormRow('REF', data.referencia, margin, y);
    y += rowHeight + 2;
    drawFormRow('TALLA', data.talla, margin, y);

    // Columna Derecha (Caja grande Descripción)
    const xRight = margin + halfWidth + gap;
    doc.setFontSize(9).setFont('Helvetica', 'bold').setTextColor(0);
    doc.text('DESCRIPCIÓN DEFECTO', xRight, yStartDetails - 1); // Título encima de la caja
    
    const boxHeight = (rowHeight * 3) + 4; // Altura equivalente a las 3 filas izq
    doc.setDrawColor(0);
    doc.rect(xRight, yStartDetails, halfWidth, boxHeight); // Solo borde
    
    doc.setFont('Helvetica', 'normal');
    const splitDesc = doc.splitTextToSize(data.defecto || '', halfWidth - 4);
    doc.text(splitDesc, xRight + 2, yStartDetails + 4);

    y = yStartDetails + boxHeight + 10; // Actualizar Y para las fotos

    // --- 3. FOTOGRAFÍAS (Cuadro grande) ---
    const boxPhotoHeight = 150;
    
    // Título centrado
    doc.setFontSize(12).setFont('Helvetica', 'bold').setTextColor(80, 80, 80);
    doc.text('INSERTAR FOTOGRAFÍAS', pageWidth / 2, y - 2, { align: 'center' });

    // Marco contenedor
    doc.rect(margin, y, contentWidth, boxPhotoHeight);

    // Grid 2x2
    const padding = 5;
    const photoW = (contentWidth - (padding * 3)) / 2;
    const photoH = (boxPhotoHeight - (padding * 3)) / 2;

    const xC1 = margin + padding;
    const xC2 = margin + padding + photoW + padding;
    const yR1 = y + padding;
    const yR2 = y + padding + photoH + padding;

    // Insertar imágenes
    if (images.delantera) doc.addImage(images.delantera, 'JPEG', xC1, yR1, photoW, photoH);
    if (images.etiqueta) doc.addImage(images.etiqueta, 'JPEG', xC2, yR1, photoW, photoH); // Etiqueta arriba derecha según diseño
    
    // Logo U-Power abajo izquierda (o foto detalle si prefieres, pero en tu imagen se ve un logo grande)
    // Según tu diseño original había 4 fotos. Si quieres replicar la imagen adjunta donde sale el logo grande abajo izq:
    try {
        const logoBig = await imageToBase64('img/upower.png');
        // Usamos una proporción aspecto más natural para el logo
        doc.addImage(logoBig, 'PNG', xC1 + 10, yR2 + 20, photoW - 20, (photoW - 20) * 0.4); 
    } catch(e) {
         // Si no carga el logo, ponemos la foto detalle si existe
         if (images.detalle) doc.addImage(images.detalle, 'JPEG', xC1, yR2, photoW, photoH);
    }
    
    // Cuarta foto (Abajo derecha)
    if (images.trasera) doc.addImage(images.trasera, 'JPEG', xC2, yR2, photoW, photoH);


    return doc.output('blob');
}

function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
}
