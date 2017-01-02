/*
   3d-breakout.js
   Prototype 'wall break' bling display for (undisclosed)
   20161211 @garyd @diemastermonkey
   Reqs: three.js, assets/bricktexture*.jpg
*/

// --------------------------------------------------------
// User settings
// --------------------------------------------------------
var sBackgroundTexture = "assets/sky.jpg";
var aBrickTextures = [
  "assets/bricktexture-0.jpg",
  "assets/bricktexture-1.jpg",
  "assets/bricktexture-2.jpg",
  "assets/bricktexture-3.jpg",
];
var sBrickTexture = "assets/bricktexture.jpg"; // Default
var fBrickSize = {x:1.5, y:0.595, z:0.250}; /* Per wikipedia */
var iBrickColumns = 6;
var iBrickRows = 8;
var fBrickCenter = {x:0, y:1.6, z:-2.7};
var bCamWander = true;    // Set to true for random cam
// Where cam centered, starts from
var oCamHome = {x:0, y:1.7, z:1.2};
// var fCamRange = 0.15;   // Max distance from home
var fCamRange = 0.01;   // Max distance from home
// Settings for stage ie background
var bStageTiled = false;
// Tween settings
var fTweenTime = 6000;

// --------------------------------------------------------
// No user mods beyond this point
// --------------------------------------------------------
// For crude translation from screen/mouse coords to cols/rows
// To do: base on browser coords
var fMouseTransX = 0.8;		// Probably don't change
var fMouseTransY = 0.7;
// Re-addressable 2d array of brick objects by row/column
var aBricks = new Array();
var oBrickTween; // Single glob tween for brick fx (RETIRE)
var aTweens = new Array(); // tweens for bricks
var oFrom;
var iTweenCol, iTweenRow;

// (Retire) Own timer for Ajax command checks
var oTimer;
var iTimerDelay = 30;
var sServerMsg = "";  // ajax via controller.js
var sShoutoutName = "DronesoundTV"; // From external

// Camera and cam motion (see also User Settings)
var fCamTime = 1000;   // Tween time ms larger is slower
var bCamFree = true;   // If false, looks at oLookAt
var oCamPos = oCamHome;  // Start at home
var oCamGo = oCamHome;
var oLookHome = { x: 0, y: oCamHome.y - 3, z: -4.0 };
var oLookAt = oLookHome;
var fLookRange = 0.5;

// Scene, Objects
var scene, renderer, camera, boxGeom, flatGeom;
var oGroundMat, oGround;
var cube, boxMat, boxTex, boxTexOff;
var iSkyRadius = 80;
var oTempTween;      // Warning: Reuse not recommended!
// Foliage
var oPlantMaterial;  // Plants
var oPlants = [];    // Array of plants
var iPlantCount = 13; // How many plants      
var fPlantHome = { x: 0, y: 0, z: -7.0 }; // Home position plus...
var fPlantRange = { x: 11, y: 0, z: 5.5 }; // Range of positions
// Chat lobby
var iSphereFaces = 12; // Smaller performs better
var fLobbyHome = { x: 0, y: 0, z: -2.5 };

// Fonts and text stuff
var oGlobalFont;      // See fnLoadFont
var oGlobalText = "DronesoundTV",
  // font = undefined,	// SHOULDNT THIS BE oGlobalFont ??
  // See also: helvetiker, optimer, gentilis, droid sans, droid serif
  // fontName = "optimer",
  fontWeight = "bold";    // End compound definition (disused)

// Lights
var oAmbientLight, oPointLight;
// Foliage texture files/urls/colors in SERVER relative paths
var sTextures = new Array ( 
  "/assets/fg-foliage-001-white.png",
  "/assets/fg-foliage-002-white.png",
  "/assets/fg-foliage-003-white.png",         
  "/assets/fg-foliage-004.png",
  "/assets/fg-foliage-005.png",
  "/assets/fg-foliage-006.png",
  "/assets/fg-foliage-007.png",
  "/assets/fg-foliage-008.png"
);
// Colors for foliage
var sColors = new Array (
  0xa2f27d, 0x295415, 0x0b6b2b, 0x08682e,  // Greenish
  0xf9cb6d, 0xf9f76d, 0xa2bff2, 0xffffff   // Others
);
  
// (DISUSED) Seedable PRNG as object
// Webkit2's crazy invertible mapping generator
// var seed = 1234;
var fnRand = (function() {
  var max = Math.pow(2, 32), seed;
    return {
      setSeed : function(val) {
        seed = val || Math.round(Math.random() * max);
      },
      getSeed : function() { return seed; },
      random : function() {
        // creates randomness...somehow...
        seed += (seed * seed) | 5;
        // Shift off bits, discard sign. Discard is
        // important, OR w/ 5 can give us + or - numbers.
        return (seed >>> 32) / max;
      }
    };
}()); // End fnRand as object
  
// Setup
function fnInit() {
  // Add event listener to resize renderer with browser
  window.addEventListener ('resize', function() {
    var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;
    renderer.setSize(WIDTH, HEIGHT);
    // OG 
    // renderer.setClearColor (0x00ff00); // BG set green screen! 

    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();
  });  // End listener		  

}      // End function
    
// (DISUSED) Timer to check for ajax object inserts
// Note: Duplicated in controller.js, fix that
// Perform per-cycle work here
function fnTimer () {
  // Test: If server buffer differs at all, insert object
  var sTemp = fnServerBufferRead(); // from controller.js 
  if (sTemp.indexOf(sServerMsg) == -1) {
    fnObjectAdd();
    fnLog ("3d: Object added via server.");
  }
  fnServerBufferClear();  // Clear taxi (controller.js)
  // Reinstate single-fire timer, see ya soon
  oTimer = setTimeout (fnTimer, iTimerDelay);
}

// -----------------------------------------------
// Font functions mostly stolen from three.js
// To do: Move to dtv-fonts.js - see also assets/*.json
// Arg is FULL font file local url, ie
//  assets/droid_serif_regular.typeface.json
// -----------------------------------------------
     
// New! MakeText both loads font and handles mesh
// AND position, so it can be called from the page 
// Load font to global oGlobalFont, create argText mesh
// Args x, y, z are center position of text
function fnMakeText (argFontURL, argText, argX, argY, argZ) {
  var loader = new THREE.FontLoader();
	loader.load (
    argFontURL,
    function (response) {
	    oGlobalFont = response;
      // Create mesh only when ready
      fnCreateText (argText, argX, argY, argZ); // Fwd args
   	  }                   // End inner anon function
  );                    // End .load
}                       // End function

// Add text to scene (AFTER font loaded see fnLoadFont)
// To do: parameterize everything
// Function: Create text after font loaded (from threejs.org)
// To do: take args instead of globs
function fnCreateText (argText, argX, argY, argZ) {
  // Temporary local material, make settable later
  // MeshNormalMaterial
  var tempMat = new THREE.MeshBasicMaterial({
      map: null, 
      shading: THREE.FlatShading,
      // wireframe: true,
      // wireframeLinewidth: 5.0,
      color: 0xffffff,
      refractionRatio: 0
  });
  // Note textGeo is local only, no later reference!
  var textGeo = new THREE.TextGeometry (
    argText,             // Should be
    {
      font: oGlobalFont,
      size: 0.5,
      height: 0.05,            // Should be called 'depth'
      curveSegments: 2,       // Fewer is faster
      bevelEnabled: false,    // Bevel disabled
      material: tempMat, 
      extrudeMaterial: 0      // Q: wtf is this?
    }                         // End TextGeo props
  );	                    // End geometry 

  textGeo.computeBoundingBox();		// Superfluous?
  textGeo.computeVertexNormals();

  // Figure center of text
  var centerOffset = -0.5 * (
    textGeo.boundingBox.max.x - textGeo.boundingBox.min.x
  );
    
  // Create and add mesh (note local scope)
  var textMesh1 = new THREE.Mesh (textGeo, tempMat);
  textMesh1.position.x = argX + centerOffset;    // Center text
  // textMesh1.position.y = 1.8;		
  textMesh1.position.y = argY;		
  // textMesh1.position.z = -2.9;
  textMesh1.position.z = argZ;
  textMesh1.rotation.x = 0;
  textMesh1.rotation.y = Math.PI * 2;	// Turn to face south
    
  // Add to (glob) scene
  fnLog ("3d: Text added to scene");
  scene.add (textMesh1);

} // End function fnCreateText
 
// (DISUSED) Add object to scene in response to ajax msg
// (see also controller.js:fnObjectAdd_3D)
function fnObjectAdd() {
  fnLog ("3D: fnObjectAdd entered");  // from controller.js
  var tempTexOff = 0.00;   // Local
  // TO DO: Load specified (user) image:
  var tempTex = THREE.ImageUtils.loadTexture ("/requestor.jpg");
  // Disused? // boxTex.needsUpdate = true;
  var tempMat = new THREE.MeshBasicMaterial({map: tempTex});
  var tempObj = new THREE.Mesh (
    new THREE.SphereGeometry (0.25, iSphereFaces, iSphereFaces ), 
    tempMat);
  tempObj.position.y = Math.random() * 2 + 0.5; // Altitude
  tempObj.position.x = Math.random() * 8 - 4;
  tempObj.position.z = Math.random() * 8 - 4;
  tempObj.rotation.y = - Math.PI / Math.random() * 2;        
  tempObj.rotation.z = - Math.PI / Math.random() * 2;        
  scene.add (tempObj); 
}

// Function: Add a single foliage plant to (global) scene
// Random pos, rot and texture, color (from array of)
function fnPlantAdd () {
  fnLog ("3d: Adding plant");
  var iTexNum = Math.round(Math.random() * 7);  // WARE hardwired array len
  // var oTempTex = THREE.ImageUtils.loadTexture (sTextures[iTexNum]);
  // var iColor = sColors[Math.round (Math.random() * 8)]; // Rand color
  // Note rand color
  var oTempObj = new THREE.Mesh (
    new THREE.PlaneGeometry (1.2, 1.0),
    new THREE.MeshBasicMaterial ({
      map: new THREE.ImageUtils.loadTexture (sTextures[iTexNum]),
      color: sColors[Math.round (Math.random() * 8)],
      reflectivity: 0, 
      transparent: true,        // For alpha ch
      opacity: 0.90,            // Nice effect 
      shading: THREE.FlatShading
    })                          // End Mesh material
  );                            // End Mesh

  // Randomize only x and z pos of plant
  oTempObj.position.x = fPlantHome.x + Math.random() 
    * fPlantRange.x - fPlantRange.x / 2;
  oTempObj.position.z = fPlantHome.z + Math.random() 
    * fPlantRange.z - fPlantRange.z / 2;
  // No rotation // oTempObj.rotation.y = -Math.PI/Math.random()*2;
  scene.add (oTempObj);    // Add it to the scene
}

// Function: Add a 'stage', backing with other elements
function fnStage (argImageURL) {
  var oTempTex = THREE.ImageUtils.loadTexture (argImageURL);
  // Permit user-configured tiling
  // See https://threejs.org/docs/api/textures/Texture.html
  if (bStageTiled == true) {
    oTempTex.wrapS = THREE.RepeatWrapping;
    oTempTex.wrapT = THREE.RepeatWrapping;
    oTempTex.repeat.set (8, 8);
  }

  var oTempObj = new THREE.Mesh (
    new THREE.PlaneGeometry (96, 96), 
    new THREE.MeshBasicMaterial ({
      map: oTempTex,
      fog: true,
      shading: THREE.FlatShading,
      refractionRatio: 0
    })                          // End material def
  );                            // End mesh
  oTempObj.doubleSided = false;
  oTempObj.position.x = 0;
  oTempObj.position.y = 0;      // Center height
  oTempObj.position.z = -40.0;   // Slightly behind center stage
  scene.add (oTempObj);         // ADD TO SCENE
}

// Function: Deploy grid of bricks!
function fnBricksInit () {
  fnLog ("3d: In fnBricksInit...");

  // Calculate top left position
  var fTopStart = fBrickCenter.y - (iBrickRows  * fBrickSize.y ) / 2;
  var fLeftStart = fBrickCenter.x - (iBrickColumns  * fBrickSize.x ) / 2 ;
  fnLog ("3d: fTopStart is " + fTopStart);
  fnLog ("3d: fLeftStart is " + fLeftStart);

  // Iterate wall brick columns/rows, generating objects for each
  for (iColumn = 0; iColumn < iBrickColumns; iColumn++) {
    // Allocate each multi-dimensional js array (weird)
    aBricks [iColumn] = new Array();
    aTweens [iColumn] = new Array(); // Own tween (retire: superfluous)
    for (iRow = 0; iRow < iBrickRows; iRow++) {
      // Choose random texture for each brick
      sBrickTexture = aBrickTextures [
        Math.round (Math.random() * (aBrickTextures.length - 1))
      ];

      // To do: Global model up top, clone it here
      // Optional hi-perf material: new THREE.MeshBasicMaterial ({
      aBricks [iColumn] [iRow] = new THREE.Mesh (
        new THREE.BoxGeometry (fBrickSize.x, fBrickSize.y, fBrickSize.z),
        new THREE.MeshLambertMaterial ({
          // For random texture:
          // map: new THREE.ImageUtils.loadTexture (sBrickTexture),
          // For random color:
          // color: Math.random() * 16777225,
          color: 0x080808,       // Math.random() * 16777225,
          reflectivity: 0, 
          transparent: true,
          opacity: 1.0,         // DEV MODE ONLY
          fog: true,
          shading: THREE.SmoothShading  // Alt: FlatShading
        })                       // End Mesh material
      );                         // End Mesh

      // Properly center
      aBricks[iColumn][iRow].position.x = 
        fLeftStart + iColumn * fBrickSize.x;
      aBricks[iColumn][iRow].position.y = 
        fTopStart + iRow * fBrickSize.y;
      aBricks[iColumn][iRow].position.z = fBrickCenter.z;

      // Name helps identify it later for punch tests!
      aBricks[iColumn][iRow].name = "brick";

      // Add to scene
      scene.add (aBricks[iColumn][iRow]);
      fnLog ("3d: Added brick at " 
        + aBricks[iColumn][iRow].position.x + ", "
        + aBricks[iColumn][iRow].position.y + ", "
        + aBricks[iColumn][iRow].position.z);

    }                          // End for iRows
  }                            // End for iColumns
}                              // End function

// Function: Figure the row/column of the brick that
// is 'under' the mouse cursor, using a raycaster and
// the document's current mouse position. To be called
// directly from the page on click, with no args
function fnPunch () {
  var oMouseCoords = new THREE.Vector2;
  var oRaycaster   = new THREE.Raycaster;
  // Get mouse document ('screen', kinda) coords
  // Convert them to global coords
  oMouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
  oMouseCoords.y = - (event.clientY / window.innerHeight) * 2 + 1;
  // Cast from camera position through 'touch' coords
  oRaycaster.setFromCamera (oMouseCoords, camera);

  // Acquire 'array' (just one) of "intersects", each of which
  // contain an object reference
  var oTargets = oRaycaster.intersectObjects (scene.children);
  if (oTargets.length > 0) {
    fnLog ("Object punched: " + oTargets[0].object.name);
    // Ignore if not a brick
    if (oTargets[0].object.name != "brick") {
      fnLog ("Not punching non-brick (see fnPunch)");
      return;
    }

    // Bling for debug - or keep?
    oTargets[0].object.material.color.set(0x777777);

    // Use the object handle to start the tween right now
    // Still use row/col for setup only.  NOTE no onUpdate given,
    // Two tweens, one for pos, other for rot - could be one
    // using same scheme as original fnTumble?
    // To do: Make configurable
    var oPosTween = new TWEEN.Tween (oTargets[0].object.position)
      .to({ x: 3, y:-7, z:-33 }, fTweenTime);

    var fRot = {                  // Rand rot target
      x: Math.random(3) * Math.PI, 
      y: Math.random(3) * Math.PI, 
      z: Math.random(3) * Math.PI 
    };
    var oRotTween = new TWEEN.Tween (oTargets[0].object.rotation)
      .to({ x:fRot.x, y:fRot.y, z:fRot.z }, fTweenTime);

    // Actually start tweens
    oPosTween.start();
    oRotTween.start();

    // or... fnTumble (col, row); // Finally, tumble that brick
  } 
}                               // End function

// Function: "Tumble-away" the brick at col/row arg position
function fnTumble (argCol, argRow) {
  // To do: Handle if already tumbled ie offscreen
  var iRandCol = Math.round (Math.random() * (iBrickColumns - 1));
  var iRandRow = Math.round (Math.random() * (iBrickRows - 1));
  // DEBUG: FORCE RANDOM COL/ROW
  argCol = iRandCol; argRow = iRandRow;

  iTweenCol = argCol; iTweenRow = argRow; // Kludge to globs
  fnLog ("3d: in fnTumble, argCol / argRow are "
    + argCol + " / " + argRow
  );

  // Pick a target Y position and tween time (HARDWIRES)
  //
  // THIS IS THE BUG! aBricks, or argCol/row or position
  // ARE UNDEFINED HERE when this runs. it's got to be one of them!
  //
  // oFrom = aBricks[argCol][argRow].position;
  oFrom = {x:0, y:1.11, z:-2.8}; // DEBUG KLUDGE

  // fTargetPos = aBricks[argCol][argRow].position;
  fTargetPos = oFrom; // DEBUG KLUDGE
  fTargetPos.y = -20;	// Arbitrary
  // var fTweenTime = Math.random() * 3 + 6;  // WARE the hardwire
  // See top // var fTweenTime = 15000;  // WARE the hardwire
  fnLog ("3d: Tween from " + oFrom.x + ", " + oFrom.y + ", " + oFrom.z);
  fnLog ("3d: Tween target " 
    + fTargetPos.x + ", " + fTargetPos.y + ", " + fTargetPos.z);

  // Instantiate new tween to target y pos ONLY
  // Q: Why creates no-ref error? Yet, starts tween 
  // NOTE: Tween MUST take a triplet compound variable ie xyz!
  aTweens[argCol][argRow] = new TWEEN.Tween ( 
    aBricks[argCol][argRow].position, {override: true}
  ).to ( {y:fTargetPos.y}, fTweenTime);
  // Ex: ease-in cubic - works but pointless?
  // ).to ( {y:fTargetPos.y}, fTweenTime, ease="cubeIn");

  // (aBricks[argCol][argRow].position).to({y:fTargetPos.y}, fTweenTime);

  // Hook tween callback to chaotic rotation updates via anon func
  // oBrickTween.onUpdate (function() {
  aTweens[argCol][argRow].onUpdate (function() {
    // Beware: argCol, argRow are UNDEFINED during tween cycle!
    // Tween must be using a reference, be wary
    aBricks[argCol][argRow].position.z -= 0.2; // Into distance 
    aBricks[argCol][argRow].rotation.z -= 0.04;  // Arbitrary
    aBricks[argCol][argRow].rotation.x -= 0.13;  
    // Other properties here if desired
  });

/*
  // Designate func to call on completion
  oBrickTween.onComplete (function() {
    // Insert code here
  });
*/

  fnLog ("3d: Starting tween for object " + argCol + ", " + argRow);
  // Actually start tween
  aTweens[argCol][argRow].start();

}                         // End function

// Function: fnShoutout
// Adds, changes, removes 'shoutout' area
// To do: Generalize to a "add plane here", w/fnStage
function fnShoutout (argImageURL) {
 // Currently using a flat plane
 var sTempTex = THREE.ImageUtils.loadTexture (argImageURL);
 var sTempMat = new THREE.MeshBasicMaterial({map: sTempTex});
 var oTempObj = new THREE.Mesh (
   new THREE.PlaneGeometry (1, 1),
   sTempMat
 );
 oTempObj.position.y = 1.0;
 oTempObj.position.z = -2.9;  // JUST in front of back
 oTempObj.doubleSided = false;

 // For now, only adds
 scene.add (oTempObj); 
}

// Function: Render called on frame update
function render() {
  requestAnimationFrame (render);     // Req frame update
  // Update wandering camera
  fnCameraAnim();
  // fnTextureAnim();  // Broke?
  renderer.render (scene, camera);    // Update
}
    	  
// DISUSED: Model loader
// Load Blender-exported ThreeJS file
function fnLoadModel() {
  // Load in the mesh and add it to the scene.
  var loader = new THREE.JSONLoader();
  loader.load( "models/BLENDEREXPORTMODEL.js", 
    function (geometry) {
      var material = 
        new THREE.MeshLambertMaterial({color: 0x99FF44});
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
  );  // End loader
}     // End function
     
// Texture animations
function fnTextureAnim() {
  // textureCanvas.offset.set(textureOffset += .001,0);
  boxTexOff += 0.01;
  oBoxTex.offset.set (boxTexOff, 0);
}
     
// Camera: Update camera tween,
// or start a random tween if inactive
function fnCameraAnim() {      
  // Update tween if cam not at cam go
  if (camera.position != oCamGo) {
    TWEEN.update();
    return;         // Done here, shunt
  }
}                   // end function
    
function fnCameraRand() { 
  // No cam tween active, set new target
  oCamGo.x = oCamHome.x + Math.random() * fCamRange - fCamRange / 2;
  // Limit to pos altitude
  oCamGo.y = oCamHome.y + Math.random() * fCamRange - fCamRange / 2;
  oCamGo.z = oCamHome.z 
    + 0.5 * (Math.random() * fCamRange - fCamRange / 2);  // Limit Z

  // Look at new destination (disabled)
  /*
  if (Math.round (Math.random() * 3) == 0) {
    oLookAt = oCamGo;
  } else {
    oLookAt.x = 0;
    oLookAt.y = 0;
    oLookAt.z = 0;
  }
  */

  // Sometimes set a new look at
  if (Math.round (Math.random() * 3) == 0) {
    oLookAt.x = Math.random() * fLookRange.x - fLookRange.x / 2;
    oLookAt.y = Math.random() * fLookRange.y - fLookRange.y / 2;
    oLookAt.z = Math.random() * fLookRange.z - fLookRange.z / 2;
  } 
    
  oCamPos = camera.position;
  // Do NOT reinstantiate Tween:
  oTween = new TWEEN.Tween(oCamPos).to(oCamGo, fCamTime); 

  // Hook tween callback to position update
  oTween.onUpdate (function() {
    camera.position.x = oCamPos.x;
    camera.position.y = oCamPos.y;
    camera.position.z = oCamPos.z;
    if (bCamFree == false) {    // If cam locked
      camera.lookAt (oLookAt);  // Stick look at
    }
  });
    
  oTween.onComplete (function() {
    fnCameraRand();            // On tween finished
  });
      
  oTween.start();              // (Re) start tween
}                              // End fnCameraRand
    
// Kludge: Setter/getter for shoutout name
function fnSetShoutout (sArgName) {
  sShoutoutName = sArgName;
  fnLog ("3d-intro.js: sShoutoutName set to " + sArgName);
}
 
// Mainline
// -----------------------------------------      
fnInit();                     // Incl. resize listener
fnRand.setSeed (1518);        // New seedable prng 
    
// Set up 3d scene - note cam parm 0 is focal len
scene = new THREE.Scene();
// Fog broken:
// fog = new THREE.Fog (0xffffff, 0.5, 2); // args 2,3 near, far 1,1000 def 
// scene.add (fog);
camera = new THREE.PerspectiveCamera (
  50, window.innerWidth/window.innerHeight, 0.1, 1000
 );
// camera.position = oCamPos; 
camera.position = oCamHome; 

// Cheap "background stage"
fnStage (sBackgroundTexture); 
    
// Light sources
oAmbientLight = new THREE.AmbientLight (0x777777); 
scene.add (oAmbientLight);
oPointLight = new THREE.PointLight (0xffffff, 1, 100);
oPointLight.position.set (0, 0, 3);
scene.add (oPointLight);
      
// Set up render/page, add the scene to dom
renderer = new THREE.WebGLRenderer();
renderer.setSize (window.innerWidth, window.innerHeight);
document.body.appendChild (renderer.domElement);
   
// Retired for 'shoutout' command w/3d .intro theme 
// fnShoutout ("/requestor.jpg");

/* DISUSED - PLANTS: Add iPlantCount randomized foliage 
for (var i=0; i < iPlantCount; i++) {
  fnPlantAdd();
} 
*/

// New: Test font! Note load from server absolute path
// Note: Loads to oGlobalFont, arg 2 is text to display
// fnLoadFont ( "/assets/droid_sans_regular.typeface.json"

// Tween setups
// var oTween = new TWEEN.Tween(oCamPos).to(oCamGo, fCamTime); // WTF?
var oTween;       // Instantiated in fnCameraRand
if (bCamWander) {
  fnCameraRand();   // Starts recurring cam wandering
}
    
// Start renderer
render();              // Repeats on clock

// Test tumbling a random brick (WONT WORK TILL WALL BUILT!)
// function fnTumble (argCol, argRow)
// fnTumble ( Math.round (Math.random() * iBrickColumns), Math.round (Math.random() * iBrickRows));

// fin
