// ====== CANVAS SETUP ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ====== PLAYER ======
let player = {
    x: 100,
    y: canvas.height - 100,
    size: 50,
    vy: 0,
    angle: 0,
    onGround: true
};
let ufoMode = false;
let jumpHolding = false;

// ====== TRAIL ======
let trail = [];

// ====== LEVEL DATA ======
let levelSpikes = [{x: 300, size: 50}, {x: 600, size: 60}, {x: 900, size: 50}];
let movingPlatforms = [{x: 400, y: canvas.height-150, width: 150, height: 20, range: 100, speed: 2, direction: 1, startY: canvas.height-150}];
let speed = 6;
let lastCheckpoint = 0;
let levelEndX = 1200;

// ====== INPUT ======
document.addEventListener('keydown', e => {
    if(e.code === 'Space' || e.code === 'ArrowUp') jumpHolding = true;
});
document.addEventListener('keyup', e => {
    if(e.code === 'Space' || e.code === 'ArrowUp') jumpHolding = false;
});

// ====== PLAYER PHYSICS ======
function updatePlayerPhysics(){
    const gravity = 0.6;
    if(ufoMode){
        if(jumpHolding) player.vy -= 0.6;
        else player.vy += 0.6;
        if(player.vy > 12) player.vy = 12;
        if(player.vy < -12) player.vy = -12;
    } else {
        if(jumpHolding && player.vy < 0) player.vy -= 0.3;
        player.vy += gravity;
        if(player.vy>0) player.vy+=0.35;
    }
    player.y += player.vy;

    let ground = canvas.height - player.size - 50;
    if(!ufoMode && player.y >= ground){
        player.y = ground; player.vy = 0; player.onGround = true; player.angle = 0;
    } else if(!ufoMode){
        player.angle += player.vy*0.03;
    }

    if(player.y < 0) player.y = 0;
}

// ====== TRAIL ======
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

// ====== SPIKES ======
function drawSpikes(ctx){
    const triBaseY = canvas.height - 50;
    levelSpikes.forEach(spike=>{
        const ax=spike.x, ay=triBaseY;
        const bx=spike.x+spike.size/2, by = triBaseY - spike.size;
        const cx=spike.x+spike.size, cy=triBaseY;
        ctx.beginPath();
        ctx.fillStyle="#FF2222";
        ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.lineTo(cx,cy);
        ctx.closePath(); ctx.fill();

        // Move spikes
        spike.x -= speed;

        // Collision
        if(player.x + player.size > ax && player.x < cx && player.y + player.size > by){
            player.x = 100; player.y = canvas.height - player.size - 50; player.vy = 0; trail = [];
        }
    });
}

// ====== PLATFORMS ======
function updatePlatforms(){
    movingPlatforms.forEach(p=>{
        p.y += p.speed*p.direction;
        if(p.y>p.startY+p.range || p.y<p.startY-p.range) p.direction*=-1;
        if(player.x+player.size>p.x && player.x<p.x+p.width &&
           player.y+player.size>p.y && player.y+player.size<p.y+p.height+10 &&
           player.vy>=0){
               player.y=p.y-player.size; player.vy=0; player.onGround=true; player.angle=0;
        }
        p.x -= speed;
    });
}
function drawPlatforms(ctx){
    ctx.fillStyle="#8888FF";
    movingPlatforms.forEach(p=> ctx.fillRect(p.x,p.y,p.width,p.height));
}

// ====== PLAYER DRAW ======
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

// ====== BACKGROUND ======
let bgLayers = [
    {color: '#1E1E1E', speedFactor: 0.2, x:0},
    {color: '#2E2E2E', speedFactor: 0.5, x:0},
    {color: '#3E3E3E', speedFactor: 0.8, x:0}
];
function updateBackground(){
    bgLayers.forEach(layer=>{
        layer.x -= speed*layer.speedFactor;
        if(layer.x<=-canvas.width) layer.x += canvas.width;
    });
}
function drawBackground(ctx){
    bgLayers.forEach(layer=>{
        ctx.fillStyle = layer.color;
        ctx.fillRect(layer.x,0,canvas.width,canvas.height);
        ctx.fillRect(layer.x+canvas.width,0,canvas.width,canvas.height);
    });
}

// ====== GAME LOOP ======
function gameLoop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    updateBackground(); drawBackground(ctx);
    updatePlayerPhysics();
    updateTrail(); drawTrail(ctx);
    updatePlatforms(); drawPlatforms(ctx);
    drawSpikes(ctx);
    drawPlayer(ctx);
    requestAnimationFrame(gameLoop);
}

gameLoop();
