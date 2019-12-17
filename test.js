function cpmPlugin(options) {
	this.options=options;
	
	this.apply=function(compiler) {
		let self=this;
		
		function emit(compilation, callback) {
			console.log('emit');
			callback();
		}
		function afterEmit(compilation, callback) {
			console.log('afterEmit');
			callback();
		}
		
		function compilation(compilation) {
			console.log('compilation');
		}
		
		compiler.plugin('emit', emit);
		compiler.plugin('after-emit', afterEmit);
		compiler.plugin('compilation', compilation);
	}
}

module.exports=cpmPlugin;