const buttonGenerate = document.getElementById('button-generate');
const buttonMode = document.getElementById('button-mode');
const button3d = document.getElementById('button-3d');
const textFieldGeneration = document.getElementById('text-field-generation-description');

function drawCanvasDesign(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = '#0dcaf0';
    ctx.fillRect(50, 50, 300, 300);
}

function toggleVisibility(divId) {
    const div = document.getElementById(divId);
    if(div.style.display === "none" || div.style.display === "") {
        div.style.display = "flex"; // show the div
    } else {
        div.style.display = "none"; // hide the div
    }
}

buttonGenerate.addEventListener('click', function () {
    const canvasDesign = document.getElementById('canvasDesign');

    const length = document.getElementById('input-design-length').value;
    const width = document.getElementById('input-design-width').value;
    const heightFloor = document.getElementById('input-design-height-floor').value;
    const floors = document.getElementById('input-design-floors').value;
    textFieldGeneration.textContent = `Volume = ${length}m x ${width}m x ${floors * heightFloor}m on ${floors} floors.`;

    // drawCanvasDesign(canvasDesign);
    //toggleVisibility("canvasContainer");
    toggleVisibility("text-field-generation-description");
    if (buttonMode.checked) {
        // TODO
    } else {
        toggleVisibility("image3D");
    }

})

// Experimental
// var bsButton = new bootstrap.Button(button)
// bsButton.toggle()
