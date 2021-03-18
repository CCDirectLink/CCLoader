window.ccmod = window.ccmod || {};
window.ccmod.injectClass = window.ccmod.injectClass || injectClass;

function injectClass(clazz) {
	if (!clazz || clazz.extend !== ig.Class.extend) {
		throw new Error('Class must extend from ig.Class');
	}

	const proto = clazz.prototype;
	const parent = Object.getPrototypeOf(proto);
	const parentClass = parent.constructor;

	const superProto = {};
	proto.__proto__ = superProto;

	const injected = {};
	const keys = Object.getOwnPropertyNames(proto);
	for (const key of keys) {
		if (key === 'constructor') {
			continue;
		}

		superProto[key] = function(...args) {
			return this.parent(...args);
		};

		injected[key] = function(...args) {
			return proto[key].apply(this, args);
		};
	}

    
	if (injected.init) {
		const original = injected.init;
		injected.init = function(...args) {
			const self = this;
			clazz.__proto__ = function(...args) {
				original.apply(self, args); 
				return self;
			};
			new clazz(...args);
		};
	} else {
		injected.init = function(...args) {
			const self = this;
			clazz.__proto__ = function(...args) {
				self.parent(...args); 
				return self;
			};
			new clazz(...args);
		};
	}

	parentClass.inject(injected);
}