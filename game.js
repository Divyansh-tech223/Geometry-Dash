// ====== CANVAS SETUP ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ====== PLAYER ======
let player = {
    x: 100,
    y: canvas.height - 50 - 50,
    size: 50,
    vy: 0,
    angle: 0,
    onGround: true
};
let ufoMode = false;
let jumpHolding = false;
const gravity = 0.6;
const jumpHoldForce = -0.3;

// ====== TRAIL ======
let trail = [];

// ====== LEVEL DATA ======
let levels = [];
let currentLevelIndex = 0;
let levelSpikes = [];
let movingPlatforms = [];
let movingObstacles = [];
let checkpoints = [];
let lastCheckpoint = 0;
let levelEndX = 0;
let speed = 6;

// ====== AUDIO ======
const jumpSound = new Audio('jump.wav');
const crashSound = new Audio('crash.wav');
const bgMusic = new Audio('bgmusic.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;
bgMusic.play();

// ====== INPUT ======
document.addEventListener('keydown', e => {
    if(e.code === 'Space' || e.code === 'ArrowUp'){
        jumpHolding = true;
        if(player.onGround || ufoMode) playJumpSound();
        player.onGround = false;
    }
    if(e.code === 'KeyP'){ paused = !paused; }
});
document.addEventListener('keyup', e => {
    if(e.code === 'Space' || e.code === 'ArrowUp') jumpHolding = false;
});

// ====== FUNCTIONS ======
function playJumpSound(){
    jumpSound.currentTime = 0;
    jumpSound.play();
}

// COLLISIONS
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy){
    const v0x=cx-ax,v0y=cy-ay;
    const v1x=bx-ax,v1y=by-ay;
    const v2x=px-ax,v2y=py-ay;
    const dot00=v0x*v0x+v0y*v0y;
    const dot01=v0x*v1x+v0y*v1y;
    const dot02=v0x*v2x+v0y*v2y;
    const dot11=v1x*v1x+v1y*v1y;
    const dot12=v1x*v2x+v1y*v2y;
    const invDenom=1/(dot00*dot11-dot01*dot01);
    const u=(dot11*dot02-dot01*dot12)*invDenom;
    const v=(dot00*dot12-dot01*dot02)*invDenom;
    return (u>=0)&&(v>=0)&&(u+v<1);
}

function spikeCollision(px, py, pSize, spike){
    const triBaseY = canvas.height - 50;
    const ax = spike.x, ay = triBaseY;
    const bx = spike.x + spike.size/2, by = triBaseY - spike.size;
    const cx = spike.x + spike.size, cy = triBaseY;
    return (
        pointInTriangle(px, py, ax, ay, bx, by, cx, cy) ||
        pointInTriangle(px+pSize, py, ax, ay, bx, by, cx, cy) ||
        pointInTriangle(px, py+pSize, ax, ay, bx, by, cx, cy) ||
        pointInTriangle(px+pSize, py+pSize, ax, ay, bx, by, cx, cy)
    );
}

function obstacleCollision(px, py, pSize, ob){
    const ox = ob.x, oy = ob.y, os = ob.size;
    return (px+pSize>ox && px<ox+os && py+pSize>oy && py<oy+os);
}

// RESTART AT CHECKPOINT
function restartAtCheckpoint(){
    crashSound.currentTime = 0;
    crashSound.play();
    player.x = lastCheckpoint ? lastCheckpoint : 100;
    player.y = canvas.height - player.size - 50;
    player.vy = 0;
    player.onGround = true;
    player.angle = 0;
    trail = [];
}

// TRAIL
function updateTrail(){
    trail.push({x: player.x + player.size/2, y: player.y + player.size/2, alpha: 1, size: player.size});
    for(let i=0;i<trail.length;i++){ trail[i].alpha -= 0.03; trail[i].size*=0.97; }
    trail = trail.filter(t => t.alpha>0);
}
function drawTrail(ctx){
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    trail.forEach(t=>{
        ctx.beginPath();
        ctx.fillStyle=`rgba(255,255,255,${t.alpha})`;
        ctx.arc(t.x,t.y,t.size/2,0,Math.PI*2);
        ctx.fill();
    });
    ctx.restore();
}

// PLAYER PHYSICS
function updatePlayerPhysics(){
    if(ufoMode){
        if(jumpHolding) player.vy -= 0.6;
        else player.vy += 0.6;
        if(player.vy>12) player.vy=12;
        if(player.vy<-12) player.vy=-12;
    } else {
        if(jumpHolding && player.vy<0) player.vy+=jumpHoldForce;
        player.vy+=gravity;
        if(player.vy>0) player.vy+=0.35;
    }
    player.y+=player.vy;
    let ground = canvas.height - player.size -50;
    if(!ufoMode && player.y>=ground){
        player.y=ground; player.vy=0; player.onGround=true; player.angle=0;
    } else if(!ufoMode){ player.angle += player.vy*0.03; }
    if(player.y<0) player.y=0;
}

// PLATFORMS & OBSTACLES
function updatePlatforms(){
    movingPlatforms.forEach(p=>{
        p.y+=p.speed*p.direction;
        if(p.y>p.startY+p.range||p.y<p.startY-p.range) p.direction*=-1;
        if(player.x+player.size>p.x && player.x<p.x+p.width &&
           player.y+player.size>p.y && player.y+player.size<p.y+p.height+10 &&
           player.vy>=0){
               player.y=p.y-player.size;
               player.vy=0;
               player.onGround=true;
               player.angle=0;
        }
    });
}
function updateObstacles(){
    movingObstacles.forEach(ob=>{
        ob.y+=ob.speed*ob.direction;
        if(ob.y>ob.startY+ob.range||ob.y<ob.startY-ob.range) ob.direction*=-1;
        if(obstacleCollision(player.x,player.y,player.size,ob)) restartAtCheckpoint();
    });
}

// LEVEL END & CHECKPOINTS
function updateLevelProgress(){
    levelSpikes.forEach(spike=>{
        spike.x -= speed;
        if(spikeCollision(player.x,player.y,player.size,spike)) restartAtCheckpoint();
    });
    levelSpikes = levelSpikes.filter(sp=>sp.x+sp.size>0);

    checkpoints.forEach(cp=>{
        if(player.x>=cp && cp>lastCheckpoint) lastCheckpoint=cp;
    });

    if(player.x>=levelEndX){ currentLevelIndex++; loadLevel(currentLevelIndex); }
}

// DRAW PLAYER & SPIKES
function drawPlayer(ctx){
    ctx.save();
    const cx=player.x+player.size/2;
    const cy=player.y+player.size/2;
    ctx.translate(cx,cy);
    if(ufoMode){
        ctx.rotate(player.vy*0.02);
        ctx.fillStyle="#00FFFF";
        ctx.beginPath();
        ctx.ellipse(0,0,player.size/2,player.size/3,0,0,Math.PI*2);
        ctx.fill();
    } else {
        ctx.rotate(player.angle);
        ctx.fillStyle="#FF5555";
        ctx.fillRect(-player.size/2,-player.size/2,player.size,player.size);
    }
    ctx.restore();
}

function drawSpikes(ctx){
    const triBaseY = canvas.height - 50;
    levelSpikes.forEach(spike=>{
        const ax=spike.x, ay=triBaseY;
        const bx=spike.x+spike.size/2, by=triBaseY-spike.size;
        const cx=spike.x+spike.size, cy=triBaseY;
        ctx.beginPath();
        const grad=ctx.createLinearGradient(ax,ay,bx,by);
        grad.addColorStop(0,"#FF2222");
        grad.addColorStop(1,"#880000");
        ctx.fillStyle=grad;
        ctx.moveTo(ax,ay);
        ctx.lineTo(bx,by);
        ctx.lineTo(cx,cy);
        ctx.closePath();
        ctx.fill();
    });
}

// BACKGROUND (placeholder images)
let bgLayers=[ // add your own Image objects here
    {image:{width:canvas.width,height:canvas.height},speedFactor:0.2,x:0},
    {image:{width:canvas.width,height:canvas.height},speedFactor:0.5,x:0},
    {image:{width:canvas.width,height:canvas.height},speedFactor:0.8,x:0}
];
function updateBackground(){
    bgLayers.forEach(layer=>{
        layer.x-=speed*layer.speedFactor;
        if(layer.x<=-canvas.width) layer.x+=canvas.width;
    });
}
function drawBackground(ctx){
    bgLayers.forEach(layer=>{
        ctx.drawImage(layer.image,layer.x,0,canvas.width,canvas.height);
        ctx.drawImage(layer.image,layer.x+canvas.width,0,canvas.width,canvas.height);
    });
}

// LEVELS
levels = [
    {
        spikes:[{x:400,size:50},{x:600,size:60},{x:800,size:50},{x:1000,size:70},{x:1200,size:60},{x:1400,size:50},{x:1600,size:70},{x:1800,size:60},{x:2000,size:50},{x:2200,size:60},{x:2400,size:50},{x:2600,size:70}],
        platforms:[{x:500,y:canvas.height-150,width:150,height:20,range:100,speed:2,direction:1,startY:canvas.height-150},{x:1100,y:canvas.height-200,width:150,height:20,range:120,speed:2.5,direction:1,startY:canvas.height-200},{x:1700,y:canvas.height-180,width:150,height:20,range:80,speed:1.8,direction:1,startY:canvas.height-180}],
        movingObstacles:[{x:800,y:canvas.height-50,size:60,range:100,speed:2,direction:1,startY:canvas.height-50},{x:1500,y:canvas.height-50,size:50,range:80,speed:1.5,direction:1,startY:canvas.height-50},{x:2100,y:canvas.height-50,size:60,range:120,speed:2,direction:1,startY:canvas.height-50}],
        checkpoints:[600,1200,1800,2400],
        length:2800
    }
];

function loadLevel(index){
    if(index>=levels.length) index=0;
    currentLevelIndex=index;
    const lvl = levels[index];
    levelSpikes = JSON.parse(JSON.stringify(lvl.spikes));
    movingPlatforms = JSON.parse(JSON.stringify(lvl.platforms));
    movingObstacles = JSON.parse(JSON.stringify(lvl.movingObstacles));
    checkpoints = JSON.parse(JSON.stringify(lvl.checkpoints));
    levelEndX = lvl.length;
    lastCheckpoint=0;
    player.x=100;
    player.y=canvas.height-player.size-50;
    player.vy=0;
    player.onGround=true;
    trail=[];
}

// ====== GAME LOOP ======
function gameLoop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    updateBackground(); drawBackground(ctx);
    updatePlayerPhysics();
    updateTrail(); drawTrail(ctx);
    updatePlatforms(); updateObstacles();
    updateLevelProgress();
    drawSpikes(ctx);
    drawPlayer(ctx);
    requestAnimationFrame(gameLoop);
}

loadLevel(0);
gameLoop();
