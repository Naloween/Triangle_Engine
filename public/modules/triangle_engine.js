import * as mat4 from "/modules/glMatrix/src/mat4.js";
import * as vec3 from "/modules/glMatrix/src/vec3.js";
import * as vec2 from "/modules/glMatrix/src/vec2.js";

// Shader Programs

const VertexShaderSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    attribute vec3 aVertexDiffuseColor;
    attribute vec3 aVertexTransparency;

    uniform mat4 uTransformMatrix;
    uniform mat4 uProjectionMatrix;
    uniform vec3 uCameraPosition;
    uniform vec3 uCurrentTransparency;
    uniform vec3 uCurrentDiffuseColor;

    varying highp vec3 vDiffuseLighting;

    void main() {
        gl_Position = uProjectionMatrix * uTransformMatrix * aVertexPosition;

        // Apply lighting effect

        highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
        highp vec3 directionalLightColor = vec3(1, 1, 1);
        highp vec3 directionalVector = normalize(vec3(1., 1., 1.));

        highp float distance = length(aVertexPosition.xyz - uCameraPosition);
  
        highp float directional = max(dot(aVertexNormal.xyz, directionalVector), 0.0);

        highp vec3 current_material_percentage = 1. - vec3(pow(uCurrentTransparency.r, distance), pow(uCurrentTransparency.g, distance), pow(uCurrentTransparency.b, distance));
        highp vec3 vertex_material_percentage = 1. - vec3(pow(aVertexTransparency.r, distance), pow(aVertexTransparency.g, distance), pow(aVertexTransparency.b, distance));

        vDiffuseLighting = current_material_percentage * uCurrentDiffuseColor + (1. - current_material_percentage) * directional * aVertexDiffuseColor;
    }
`;

const FragmentShaderSource = `
    varying highp vec3 vDiffuseLighting;

    void main() {
        gl_FragColor = vec4(vDiffuseLighting, 1.);
    }
`;

// Classes

class Light{
    static next_id = 0;
    constructor(power, color, position){
        this.power = power;
        this.color = color;
        this.position = position;
        this.id = -1;
    }

    toArray(){
        let result = [this.power];
        result = result.concat(this.color);
        result = result.concat(this.position);

        return result;
    }
}

class Material{
    static next_id = 0;
    constructor(diffusion, transparency, reflection, refraction){
        this.diffusion = diffusion; // diffusion pour chaque couleur, entre 0 (transparent) et 1 (opaque)
        this.transparency = transparency;
        this.reflection = reflection; // entre 0 et 1
        this.refraction = refraction; //n1*sin(i) = n2*sin(r)
        this.id = -1;
    }

    toArray(){
        let result = this.diffusion;
        result = result.concat(this.transparency);
        result = result.concat(this.reflection);
        result = result.concat(this.refraction);

        return result //[r, g, b, transparency, reflection, refraction]
    }
}

class Camera{
    constructor(width, height, render_distance=100){
        this.width = width;
        this.height = height;

        this.position = [0.0,0.0,0.0];
        this.teta = 0.0;
        this.phi = Math.PI/2.0;

        this.aspect = this.width / this.height;
        this.zNear = 0.1;
        this.zFar = render_distance;
        this.fov = 45 * Math.PI / 180; //in radiant
        this.diaphragme = 1;

        this.projectionMatrix = mat4.create();

        this.update();
    }

    update(){
        
        mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.zNear, this.zFar);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.phi, [1, 0, 0]);
        mat4.rotate(this.projectionMatrix, this.projectionMatrix, this.teta, [0, 0, -1]);
        mat4.translate(this.projectionMatrix, this.projectionMatrix, this.position);
    }
}

class TriangleEngine{
    constructor(gl){
        console
        this.gl = gl;
        this.shaderProgram = this.initShaderProgram(VertexShaderSource, FragmentShaderSource);
        
        this.nb_indexes = 0;

        // buffers
        this.indexBuffer = this.gl.createBuffer();

        this.positionBuffer = this.gl.createBuffer();
        this.normalBuffer = this.gl.createBuffer();
        this.diffuseColorBuffer = this.gl.createBuffer();
        this.transparencyBuffer = this.gl.createBuffer();
        
        // attributes locations
        this.vertexPositionLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexPosition');
        this.vertexNormalLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexNormal');
        this.vertexDiffuseColorLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexDiffuseColor');
        this.vertexTransparencyLocation = this.gl.getAttribLocation(this.shaderProgram, 'aVertexTransparency');

        // uniforms locations
        this.projectionMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix');
        this.TransformMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'uTransformMatrix');
        this.cameraPositionLocation = this.gl.getUniformLocation(this.shaderProgram, 'uCameraPosition');
        this.currentTransparencyLocation = this.gl.getUniformLocation(this.shaderProgram, 'uCurrentTransparency');
        this.currentDiffuseColorLocation = this.gl.getUniformLocation(this.shaderProgram, 'uCurrentDiffuseColor');
        

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(this.vertexPositionLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.vertexPositionLocation);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.vertexAttribPointer(this.vertexNormalLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.vertexNormalLocation);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.diffuseColorBuffer);
        this.gl.vertexAttribPointer(this.vertexDiffuseColorLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.vertexDiffuseColorLocation);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.transparencyBuffer);
        this.gl.vertexAttribPointer(this.vertexTransparencyLocation, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.vertexTransparencyLocation);
    
        this.gl.useProgram(this.shaderProgram);
    }

    render(){
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Clear to fully transparent
        this.gl.clearDepth(1.0);                 // Clear everything
        this.gl.enable(this.gl.DEPTH_TEST);           // Enable depth testing
        this.gl.depthFunc(this.gl.LEQUAL);            // Near things obscure far things
        
        // Clear the canvas before we start drawing on it.
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Tell WebGL which indices to use to index the vertices
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        this.gl.drawElements(this.gl.TRIANGLES, this.nb_indexes, this.gl.UNSIGNED_INT, 0);
    }

    initShaderProgram(vsSource, fsSource) {
        const vertexShader = this.loadShader(this.gl, this.gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.loadShader(this.gl, this.gl.FRAGMENT_SHADER, fsSource);
    
        // Créer le programme shader
    
        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        // Si la création du programme shader a échoué, alerte
    
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
        alert("Impossible d'initialiser le programme shader : " + this.gl.getProgramInfoLog(shaderProgram));
        return null;
        }
    
        return shaderProgram;
    }
    
    loadShader(gl, type, source) {
        // Crée un shader du type fourni, charge le source et le compile.


        const shader = gl.createShader(type);
    
        // Envoyer le source à l'objet shader
        gl.shaderSource(shader, source);
    
        // Compiler le programme shader
        gl.compileShader(shader);
    
        // Vérifier s'il a été compilé avec succès
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
        }
    
        return shader;
    }

    setBuffers(positions, normals, diffuseColor, transparency, indexes) {
  
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);    
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.diffuseColorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(diffuseColor), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.transparencyBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(transparency), this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indexes), this.gl.STATIC_DRAW);
    }

    updateVertices(offset, positions, normals, diffuseColor, transparency) {
  
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);    
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * 4, new Float32Array(positions));

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.normalBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * 4, new Float32Array(normals));

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.diffuseColorBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * 4, new Float32Array(diffuseColor));

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.transparencyBuffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset * 4, new Float32Array(transparency));
    }

    setCameraUniforms(camera){
        // Set the shader uniform projection matrix
        this.gl.uniformMatrix4fv(this.projectionMatrixLocation, false, camera.projectionMatrix);

        // Set the shader uniform camera position
        this.gl.uniform3f(this.cameraPositionLocation, -camera.position[0], -camera.position[1], -camera.position[2]);

    }

    setCurrentMaterialUniforms(transparency, diffuseColor){
        this.gl.uniform3f(this.currentTransparencyLocation, transparency[0], transparency[1], transparency[2]);
        this.gl.uniform3f(this.currentDiffuseColorLocation, diffuseColor[0], diffuseColor[1], diffuseColor[2]);
    }

    setTransformVertices(TransformMatrix){
        // Set the shader uniforms
        this.gl.uniformMatrix4fv(this.TransformMatrixLocation, false, TransformMatrix);
    }

    loadTexture(url) {    
        const image = new Image();
        image.onload = function() {
            function isPowerOf2(value) {
                return (value & (value - 1)) == 0;
            }

            const level = 0;
            const internalFormat = this.gl.RGBA;
            const width = 1;
            const height = 1;
            const border = 0;
            const srcFormat = this.gl.RGBA;
            const srcType = this.gl.UNSIGNED_BYTE;
            const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue

            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
    
            // WebGL1 has different requirements for power of 2 images
            // vs non power of 2 images so check if the image is a
            // power of 2 in both dimensions.
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                // Yes, it's a power of 2. Generate mips.
                this.gl.generateMipmap(this.gl.TEXTURE_2D);
            } else {
                // No, it's not a power of 2. Turn off mips and set
                // wrapping to clamp to edge
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            }
        }.bind(this);

        image.src = url;
    }
}

export {Light, Material, Camera, TriangleEngine}
