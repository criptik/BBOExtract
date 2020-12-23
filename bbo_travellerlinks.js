(function(){
	var g_found = false;
	var bbo_links = new Array();
	var g_index = 0;
	
	function tryBBOTravellerLinks(pwindow)
	{
		try {
			var maindiv = pwindow.document.querySelectorAll("div.bbo_content");
			
			if (maindiv.length>0)
			{
				var table = maindiv[0].getElementsByTagName("table");
				
				if (table.length>0)
				{
					var rows = table[0].rows;
				
					for (var i=1;i<rows.length;i++)	// Omit Header Row
					{
						var cell = rows[i].cells[0];
						
						var ref = cell.querySelector("a");
						var lnk = ref.href;
						
						var lnkObject = new Object();
						lnkObject.section = 1;	//***** Assume all section number 1, for now
						lnkObject.lnk = lnk;
						
							// Need to store links for both NS and EW because sometimes a North or East player is substituted
							// for some boards and this can mean their results do not appear in the scorecard for the main Morth or East player 
						bbo_links.push(lnkObject);
	
					}
				}
			}
			
			if (bbo_links.length!=0)
			{
				chrome.runtime.sendMessage({op:"travellerLinks","para":bbo_links,"src":window.location.href});
				bbo_links = new Array();
				return 0;	// success, with links
			}
		} catch (err) {}
		
			// No data, or didn't get a results page
		var pw = pwindow.document.getElementsByTagName("body");
		var pwindex = pw[0].innerText.indexOf("Password");
		
		if (pwindex!=-1)
		{
			alert("You must log in with any valid BBO username/password first.\nPlease log in here, close this tab, then click on the BBO Extractor icon again.");
		}
		else
		{
			var status = -1;	// First assume request had negative response, but is retryable
			var table = document.getElementsByTagName("table");
			
			if (table.length>0)
			{
				table = table[0];
				
				if (table.rows.length>1)
				{
					var txt = table.rows[1].innerText;
					
					if (txt.indexOf("Some tourneys not shown for security reasons")!=-1)
					{
						status = -2;
					}
				}
				
				if (table.innerText.indexOf("No data found")!=-1)
				{
					var str = "No data on this page. Either data has not been loaded yet, or has been removed from BBO database. ";
					str += "If this is a tournament that has recently ended, wait a few minutes then try again. BBO Extractor will now stop."
					alert(str);
					status = -3;
				}
			}
			
			var results = new Object();
			results.status = status;
			chrome.runtime.sendMessage({op:"getTravLinksFailed","para":results,"src":window.location.href},function(){});
		}
	}
	
	function runScript(pwindow)
	{
		return tryBBOTravellerLinks(pwindow);
	}
	
	var result = runScript(this);
	return result;
})();
