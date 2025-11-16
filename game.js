// FULL-SCREEN CANVAS
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.onresize = resize;

// AUDIO
const bgm = document.getElementById("bgm");
const jumpSound = document.getElementById("jumpSound");
const crashSound = document.getElementById("crashSound");

// PLAYER
let player = { x: 100, y: 0, size: 40, vy: 0, onGround: false, angle: 0 };
let gravity = 1.2;
let jumpForce = -22;
let jumpHoldForce = -0.8;
let speed = 10;
let paused = false;
let jumpHolding = false;
let ufoMode = false;
let trail = [];

// PARALLAX BACKGROUND
const bgLayers = [
    { speed: 0.2, color: "#111", objects: [] },
    { speed: 0.5, color: "#333", objects: [] },
    { speed: 1, color: "#555", objects: [] }
];
function initLayers() {
    bgLayers[0].objects = Array.from({length: 50}, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height - 200),
        size: Math.random() * 2 + 1
    }));
    bgLayers[1].objects = Array.from({length: 10}, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height - 150,
        width: Math.random() * 200 + 100,
        height: Math.random() * 100 + 50
    }));
    bgLayers[2].objects = Array.from({length: 10}, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height - 80,
        width: Math.random() * 150 + 50,
        height: Math.random() * 50 + 30
    }));
}
initLayers();

// MULTI-LEVEL SYSTEM
let levels = [
    {
        spikes: [{x:600,size:60},{x:900,size:50}],
        platforms: [{x:500,y:canvas.height-150,width:150,height:20,range:100,speed:2}],
        movingObstacles: [{x:800,y:canvas.height-50,size:60,range:100,speed:2}],
        length: 3000
    },
    {
        spikes: [{x:400,size:50},{x:700,size:70},{x:1200,size:60}],
        platforms: [{x:600,y:canvas.height-200,width:200,height:20,range:120,speed:3}],
        movingObstacles: [{x:1000,y:canvas.height-50,size:60,range:150,speed:2}],
        length: 4000
    }
];
let currentLevelIndex = 0;
let levelEndX = 3000;
let levelSpikes = [];
let movingPlatforms = [];
let movingObstacles = [];
let checkpoints = [];
let lastCheckpoint = 0;

// EDITOR MODE
let editorMode = false;
function createEmptyLevel(length = 3000) {
    return { spikes: [], platforms: [], movingObstacles: [], checkpoints: [], length };
}

// LOAD LEVEL
function loadLevel(index){
    const level = levels[index];
    if(!level){
        alert("You completed all levels!");
        currentLevelIndex = 0;
        loadLevel(currentLevelIndex);
        return;
    }
    levelSpikes = level.spikes || [];
    movingPlatforms = level.platforms || [];
    movingObstacles = level.movingObstacles || [];
    checkpoints = [];
    lastCheckpoint = 0;
    levelEndX = level.length || 3000;
    player.x = 100;
    player.y = canvas.height - player.size - 50;
    player.vy = 0;
    player.onGround = true;
    player.angle = 0;
    trail = [];
}

// PLAYER INPUT
document.addEventListener("keydown", (e) => {
    if(e.key === " " && !paused){
        if(!ufoMode && player.onGround){
            player.vy = jumpForce;
            player.onGround = false;
        }
        if(ufoMode || (!ufoMode && player.onGround)){
            jumpSound.currentTime = 0;
            jumpSound.play();
        }
        jumpHolding = true;
    }
    if(e.key.toLowerCase() === "p") paused = !paused;
    if(e.key.toLowerCase() === "u") ufoMode = !ufoMode;
    if(e.key.toLowerCase() === "e") editorMode = !editorMode;
});

// STOP JUMP
document.addEventListener("keyup",(e)=>{ if(e.key === " ") jumpHolding=false; });

// SAVE/LOAD MULTI-LEVELS IN EDITOR
document.addEventListener("keydown",(e)=>{
    if(!editorMode) return;
    if(e.key.toLowerCase() === "s"){
        localStorage.setItem("multiLevels", JSON.stringify(levels));
        alert("All levels saved!");
    }
    if(e.key.toLowerCase() === "l"){
        const saved = JSON.parse(localStorage.getItem("multiLevels"));
        if(saved) levels = saved;
        alert("Levels loaded!");
    }
    if(e.key.toLowerCase() === "n"){
        levels.push(createEmptyLevel());
        currentLevelIndex = levels.length-1;
        alert("New level created!");
    }
    if(e.key.toLowerCase() === "tab"){
        currentLevelIndex = (currentLevelIndex + 1) % levels.length;
        alert("Editing Level " + (currentLevelIndex+1));
    }
});

// MOUSE INPUT IN EDITOR
canvas.addEventListener("mousedown",(e)=>{
    if(!editorMode) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const level = levels[currentLevelIndex];
    if(e.button===0) level.spikes.push({x:x,size:50 + Math.random()*50});
    else if(e.button===2){ level.checkpoints.push(x); lastCheckpoint=x; }
});
canvas.addEventListener("contextmenu",(e)=>e.preventDefault());

// COLLISION CHECK
function collisionTriangle(px, py, pSize, tx, tSize){
    let triTop = canvas.height - 50 - tSize;
    let triBottom = canvas.height - 50;
    if(px + pSize < tx) return false;
    if(px > tx + tSize) return false;
    if(py + pSize < triTop) return false;
    if(py > triBottom) return false;
    return true;
}

// RESTART AT CHECKPOINT
function restartAtCheckpoint(){
    player.x = lastCheckpoint ? lastCheckpoint : 100;
    player.y = canvas.height - player.size - 50;
    player.vy = 0;
    player.onGround = true;
    player.angle = 0;
    trail = [];
}

// MAIN UPDATE
function update(){
    if(editorMode) return;

    // PLAYER PHYSICS
    if(ufoMode){
        if(jumpHolding) player.vy -=0.7;
        else player.vy +=0.7;
        if(player.vy>12) player.vy=12;
        if(player.vy<-12) player.vy=-12;
    }else{
        if(jumpHolding && player.vy<0) player.vy += jumpHoldForce;
        player.vy += gravity;
        if(player.vy>0) player.vy +=0.4;
    }
    player.y += player.vy;
    let ground = canvas.height - player.size -50;
    if(!ufoMode && player.y>=ground){
        player.y=ground; player.vy=0; player.onGround=true; player.angle=0;
    }else if(!ufoMode){ player.angle += player.vy*0.03; }

    // MOVE BACKGROUND
    bgLayers.forEach(layer=>{
        layer.objects.forEach(obj=>{
            obj.x -= layer.speed*speed;
            if(obj.x + (obj.width||obj.size)<0) obj.x=canvas.width+Math.random()*100;
        });
    });

    // TRAIL
    trail.push({x:player.x+player.size/2,y:player.y+player.size/2});
    if(trail.length>25) trail.shift();

    // LEVEL PROGRESSION
    if(player.x >= levelEndX){ currentLevelIndex++; loadLevel(currentLevelIndex); }

    // MOVE SPIKES
    levelSpikes.forEach(ob=>{
        ob.x -= speed;
        if(collisionTriangle(player.x, player.y, player.size, ob.x, ob.size)){
            crashSound.currentTime=0; crashSound.play();
            restartAtCheckpoint();
        }
    });
    levelSpikes = levelSpikes.filter(ob=>ob.x+ob.size>0);

    // MOVE MOVING PLATFORMS
    movingPlatforms.forEach(p=>{
        p.y += p.speed*p.direction;
        if(p.y>p.startY+p.range || p.y<p.startY-p.range) p.direction*=-1;
        if(player.x+player.size>p.x && player.x<p.x+p.width &&
           player.y+player.size>p.y && player.y+player.size<p.y+p.height+20){
               player.y=p.y-player.size; player.vy=0; player.onGround=true;
           }
    });

    // MOVE MOVING OBSTACLES
    movingObstacles.forEach(ob=>{
        ob.y += ob.speed*ob.direction;
        if(ob.y>ob.startY+ob.range || ob.y<ob.startY-ob.range) ob.direction*=-1;
        if(collisionTriangle(player.x,player.y,player.size,ob.x,ob.size)){
            crashSound.currentTime=0; crashSound.play();
            restartAtCheckpoint();
        }
    });
}

// DRAW EVERYTHING
function draw(){
    // CLEAR
    ctx.fillStyle="#000"; ctx.fillRect(0,0,canvas.width,canvas.height);

    // BACKGROUND
    bgLayers.forEach(layer=>{
        ctx.fillStyle=layer.color;
        layer.objects.forEach(obj=>{
            if(layer.speed===0.2){ ctx.beginPath(); ctx.arc(obj.x,obj.y,obj.size,0,Math.PI*2); ctx.fill(); }
            else ctx.fillRect(obj.x,obj.y,obj.width,obj.height);
        });
    });

    // TRAIL
    for(let i=0;i<trail.length;i++){
        let alpha=i/trail.length;
        ctx.fillStyle=`rgba(0,234,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(trail[i].x,trail[i].y,player.size/2,0,Math.PI*2);
        ctx.fill();
    }

    // PLAYER
    ctx.save();
    ctx.translate(player.x+player.size/2,player.y+player.size/2);
    ctx.rotate(player.angle);
    ctx.fillStyle="#00eaff";
    ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
    ctx.restore();

    // GROUND
    ctx.fillStyle="#444";
    ctx.fillRect(0,canvas.height-50,canvas.width,50);

    // SPIKES
    ctx.fillStyle="#ff0055";
    levelSpikes.forEach(ob=>{
        ctx.beginPath();
        ctx.moveTo(ob.x,canvas.height-50);
        ctx.lineTo(ob.x+ob.size/2,canvas.height-50-ob.size);
        ctx.lineTo(ob.x+ob.size,canvas.height-50);
        ctx.closePath(); ctx.fill();
    });

    // MOVING PLATFORMS
    ctx.fillStyle="#ffaa00";
    movingPlatforms.forEach(p=>ctx.fillRect(p.x,p.y,p.width,p.height));

    // MOVING OBSTACLES
    ctx.fillStyle="#ff00ff";
    movingObstacles.forEach(ob=>{
        ctx.beginPath();
        ctx.moveTo(ob.x,ob.y+ob.size);
        ctx.lineTo(ob.x+ob.size/2,ob.y);
        ctx.lineTo(ob.x+ob.size,ob.y+ob.size);
        ctx.closePath(); ctx.fill();
    });

    // CHECKPOINTS
    ctx.fillStyle="#00ff00";
    checkpoints.forEach(cp=>ctx.fillRect(cp-5,canvas.height-50,10,50));

    // PAUSE MESSAGE
    if(paused){ ctx.fillStyle="#fff"; ctx.font="40px Arial"; ctx.fillText("PAUSED (Press P)",canvas.width/2-150,canvas.height/2); }

    // UFO MODE
    ctx.fillStyle="#fff"; ctx.font="20px Arial";
    ctx.fillText("UFO MODE: "+(ufoMode?"ON":"OFF")+" (Press U)",20,30);

    // LEVEL NUMBER
    ctx.fillText("Level: "+(currentLevelIndex+1),canvas.width-120,30);
}

// MAIN LOOP
function gameLoop(){ if(!paused) update(); draw(); requestAnimationFrame(gameLoop); }

// START
loadLevel(currentLevelIndex);
gameLoop();
