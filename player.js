Engine.include("/components/component.mover2d.js");
Engine.include("/components/component.keyboardinput.js");
Engine.include("/engine/engine.object2d.js");
Engine.include("/components/component.collider.js");
Engine.include("/engine/engine.timers.js");
Engine.include("/components/component.sprite.js");

Engine.initObject("Player", "Object2D", function() {

/**
 * @class The player object.  Creates the player and assigns the
 *		  components which handle collision, drawing, drawing the thrust
 *		  and moving the object.
 */
var Player = Object2D.extend({

	size: 4,

	field: null,
	
	velocity: null,
	direction: null,
	
	bullets: 0,

	players: 3,

	alive: false,
	
	playerSprites: null,

	directionData: {
		"left": {
			"angle": 270,
			"gunTip": new Point2D(0, 9),
		},
		"right": {
			"angle": 90,
			"gunTip": new Point2D(44, 9),
		}
	},
	left: "left",
	right: "right",

	constructor: function() {
		this.base("Player");

		this.field = PistolSlut;

		// Add components to move and draw the player
		this.add(KeyboardInputComponent.create("input"));
		this.add(Mover2DComponent.create("move"));
		this.add(SpriteComponent.create("draw"));
		this.add(ColliderComponent.create("collide", this.field.collisionModel));
		
		this.playerSprites = {};
		this.playerSprites["rightstand"] = this.field.spriteLoader.getSprite("girl", "rightstand");
		this.playerSprites["rightrun"] = this.field.spriteLoader.getSprite("girl", "rightrun");
		this.playerSprites["leftstand"] = this.field.spriteLoader.getSprite("girl", "leftstand");
		this.playerSprites["leftrun"] = this.field.spriteLoader.getSprite("girl", "leftrun");
		
		this.direction = this.right;
		this.players--;
		this.velocity = Vector2D.create(0, 0);

		this.alive = true;
	},

	destroy: function() {
		if (this.ModelData && this.ModelData.lastNode) {
			this.ModelData.lastNode.removeObject(this);
		}
		this.base();
	},

	release: function() {
		this.base();
		this.size = 4;
		this.bullets = 0;
		this.players = 3;
		this.alive = false;
		this.velocity = null;
		this.direction = null;
		this.playerSprites = null;
		this.directionData = null;
		this.left = null;
		this.right = null;
	},

	move: function() {
		this.setPosition(this.getPosition().add(this.velocity));
		this.field.updateFramePosition(this.velocity, this); // move the render frame in response to player movement

		// set sprite
		if(this.velocity.x != 0)
			this.setSprite(this.direction + "run");
		else
			this.setSprite(this.direction + "stand");
	},

	onCollide: function(obj) {
		return this.collisionWith(obj); // deal with it own self;
	},

	collisionWith: function(obj) {
		if(obj instanceof Furniture && this.field.collider.colliding(this, [obj]))
		{
			if(this.field.collider.aFallingThroughB(this, obj))
			{
				this.endFall(obj);
				return ColliderComponent.STOP;
			}
			else if(this.field.collider.aOnLeftAndBumpingB(this, obj))
			{
				this.stopWalk(obj.getPosition().x - this.getBoundingBox().dims.x - 1);
				return ColliderComponent.STOP;
			}
			else if(this.field.collider.aOnRightAndBumpingB(this, obj))
			{
				this.stopWalk(obj.getPosition().x + obj.getBoundingBox().dims.x + 1);
				return ColliderComponent.STOP;
			}
		}
		return ColliderComponent.CONTINUE;
	},

	/**
	 * Update the player within the rendering context.  This draws
	 * the shape to the context, after updating the transform of the
	 * object.  If the player is thrusting, draw the thrust flame
	 * under the ship.
	 *
	 * @param renderContext {RenderContext} The rendering context
	 * @param time {Number} The engine time in milliseconds
	 */
	update: function(renderContext, time) {
		renderContext.pushTransform();
		this.move();
		this.base(renderContext, time);
		renderContext.popTransform();
	},

  setSprite: function(spriteKey) {
	  var sprite = this.playerSprites[spriteKey];
	  this.setBoundingBox(sprite.getBoundingBox());
	  this.getComponent("draw").setSprite(sprite);
  },

	/**
	 * Get the position of the ship from the mover component.
	 * @type Point2D
	 */
	getPosition: function() {
		return this.getComponent("move").getPosition();
	},

	getRenderPosition: function() {
		return this.getComponent("move").getRenderPosition();
	},

	/**
	 * Get the last position the ship was at before the current move.
	 * @type Point2D
	 */
	getLastPosition: function() {
		return this.getComponent("move").getLastPosition();
	},

	/**
	 * Set, or initialize, the position of the mover component
	 *
	 * @param point {Point2D} The position to draw the ship in the playfield
	 */
	setPosition: function(point) {
		this.base(point);
		this.getComponent("move").setPosition(point);
	},

	/**
	 * Get the rotation of the ship from the mover component.
	 * @type Number
	 */
	getRotation: function() {
		return this.getComponent("move").getRotation();
	},

	/**
	 * Set the rotation of the ship on the mover component.
	 *
	 * @param angle {Number} The rotation angle of the ship
	 */
	setRotation: function(angle) {
		this.base(angle);
		this.getComponent("move").setRotation(angle);
	},

	getScale: function() {
		return this.getComponent("move").getScale();
	},

	setScale: function(scale) {
		this.base(scale);
		this.getComponent("move").setScale(scale);
	},

	/**
	 * Set up the player object on the playfield.  The width and
	 * heigh of the playfield are used to determine the center point
	 * where the player starts.
	 *
	 * @param pWidth {Number} The width of the playfield in pixels
	 * @param pHeight {Number} The height of the playfield in pixels
	 */
	setup: function(pWidth, pHeight) {
		this.pBox = Rectangle2D.create(0, 0, pWidth, pHeight); // Playfield bounding box for quick checks

		// Put us on the ground in the middle
		var c_mover = this.getComponent("move");
		c_mover.setPosition(new Point2D(50, this.field.groundY));
	},

	/**
	 * Called when the player shoots a bullet to create a bullet
	 * in the playfield and keep track of the active number of bullets.
	 */
	muzzleFlashSpread: 15,
	muzzleParticleCount: 10,
	muzzleParticleTTL: 500,
	shootDelay: 100,
	lastShot: 0,
	shoot: function() {
		if(new Date().getTime() - this.lastShot > this.shootDelay)
		{
			this.lastShot = new Date().getTime();
			var bullet = Bullet.create(this);
			this.field.renderContext.add(bullet);
			this.bullets++;

			var gunTipInWorld = new Point2D(this.getGunTip()).add(this.getPosition());
			for (var x = 0; x < this.muzzleParticleCount; x++)
				PistolSlut.pEngine.addParticle(BurnoutParticle.create(gunTipInWorld, this.getGunAngle(), this.velocity, this.muzzleFlashSpread, this.muzzleParticleTTL));
		}
	},
	
	jumping: false,
	jumpSpeed: -4.5,
	postJumpVector: Vector2D.create(0, -1),
	jump: function() {
		if(!this.jumping)
		{
			this.jumping = true;
			this.velocity.add(Vector2D.create(0, this.jumpSpeed));
			this.setPosition(this.getPosition().add(this.postJumpVector));
		}
	},

	walking: false,	
	runSpeed: 3,
	walk: function(direction) {
		if(!this.walking)
		{
			this.walking = true;
			this.direction = direction;
			if(direction == this.left)
				this.velocity.add(Vector2D.create(-this.runSpeed, 0));
			else if(direction == this.right)
				this.velocity.add(Vector2D.create(this.runSpeed, 0));
		}
	},

	stopWalk: function(newX) {
		this.velocity.setX(0);
		this.walking = false;
		if(newX != null)
			this.setPosition(Point2D.create(newX, this.getPosition().y));
	},
	
	endFall: function(groundObj) {
		var newPos = Point2D.create(this.getPosition().x, groundObj.getPosition().y).sub(Vector2D.create(0, this.getBoundingBox().dims.y));
		this.setPosition(newPos);
		this.velocity.setY(0);
		this.jumping = false;
	},

	/**
	 * Kills the player, creating the particle explosion and removing a
	 * life from the extra lives.  Afterwards, it determines if the
	 * player can respawn (any lives left) and either calls the
	 * respawn method or signals that the game is over.
	 */
	kill: function() {
		this.alive = false;

		this.getComponent("draw").setDrawMode(RenderComponent.NO_DRAW);

		var pCount = 40;

		this.getComponent("move").setVelocity(Point2D.ZERO);
		this.getComponent("move").setPosition(this.getRenderContext().getBoundingBox().getCenter());
		this.getComponent("move").setRotation(0);

		// Remove one of the players
		if (this.players-- > 0)
		{
			// Set a timer to spawn another player
			var pl = this;
			OneShotTimeout.create("respawn", 3000, function() { pl.respawn(); });
		}
	},

	/**
	 * Called by the keyboard input component to handle a key down event.
	 *
	 * @param event {Event} The event object
	 */
	onKeyDown: function(event) {
		if (!this.alive)
			return;
		
		switch (event.keyCode) {
			case EventEngine.KEYCODE_LEFT_ARROW:
				this.walk(this.left);
				break;
			case EventEngine.KEYCODE_RIGHT_ARROW:
				this.walk(this.right);
				break;
			case EventEngine.KEYCODE_UP_ARROW:
				break;
			case 90: // z
				this.jump();
				break;
			case 88: // x
				this.shoot();
				break;
			case 67: // c
				break;
		}
		
		return false;
	},
	
	/**
	 * Called by the keyboard input component to handle a key up event.
	 *
	 * @param event {Event} The event object
	 */
	onKeyUp: function(event) {
		if (!this.alive)
			return;

		switch (event.keyCode) {
			case EventEngine.KEYCODE_LEFT_ARROW:
			case EventEngine.KEYCODE_RIGHT_ARROW:
				this.stopWalk(null);
				break;
			case EventEngine.KEYCODE_UP_ARROW:
				break;
		}
		
		return false;
	},
	
	getGunAngle: function() {
		return this.directionData[this.direction]["angle"];
	},
	
	getGunTip: function() {
		return this.directionData[this.direction]["gunTip"];
	},

  removeBullet: function() {
     // Clean up
     this.bullets--;
  },

	}, { // Static
		getClassName: function() {
			return "Player";
		},
	});


	return Player;
});