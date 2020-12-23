// JavaScript Document
(function(){
		  // Could be a Names file
	try {
		var txt = this.document.getElementsByTagName("body")[0].textContent;
		
		if (txt.indexOf("#names")!=-1)
		{
			chrome.runtime.sendMessage({op:"names","para":txt,"src":window.location.href});
		}
	} catch (e) {alert("error");}
})();