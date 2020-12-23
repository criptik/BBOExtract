(function(){
	function getLinNames(lin)
	{
		var names = "";
		
		var idx = lin.indexOf("pn|");
		
		if (idx!=-1)
		{
			var str = lin.substring(idx+3);
			idx = str.indexOf("|");
			
			if (idx!=-1)
			{
				names = str.substring(0,idx);				
				names = names.split(",");
			}
		}
		
		return names;
	}
	
	function tryBBOLinFiles(pwindow)
	{
		var matchpoints = false;	// Initially assume it's an Ximps event
		
		try {
			var resstr = "";
			var tdate = "";
			var tournament = "";
			var body = pwindow.document.querySelectorAll("body.bbo_content");
			var table = body[0].querySelectorAll("table.body");
			var username = table[0].querySelectorAll("span.username");
			
			if (username.length!=0)
				username = username[0].innerText.toUpperCase();
			else
				username = "";
			
			var ths = table[0].getElementsByTagName("th");
			
			if (ths.length>1)	// Extract date from here only if it's a scorecard (traveller doesn't show full date)
			{
				var tmp = ths[1].innerText;
				
				if ((tmp.length==10)&(username!==""))
					tdate = tmp;
			}
			
			if (body.length!=0)
			{
				var movies = body[0].querySelectorAll("td.movie");
				
				for (var i=0;i<movies.length;i++)
				{
					var scoretext = movies[i].previousElementSibling;
					var score = scoretext.innerText;
					
					var numscore = scoretext.previousElementSibling;
					var result = numscore.previousElementSibling;
					var west = result.previousElementSibling;
					var east = west.previousElementSibling;
					var south = east.previousElementSibling;
					var north = south.previousElementSibling;
					var date = north.previousElementSibling;
					
					date = date.innerText;
					
					tdate = date;
					
					west = west.innerText;
					east = east.innerText;
					south = south.innerText;
					north = north.innerText;
					
					result = result.innerText;
					
						// Don't store sitout lines in the csv
//					if (result.toUpperCase()=="SITOUT") continue;
					
					numscore = numscore.innerText;
					
					result = result.replace(/\u2660/,"S");
					result = result.replace(/\u2665/,"H");
					result = result.replace(/\u2666/,"D");
					result = result.replace(/\u2663/,"C");
					
					var contract = "";
					var level = 0;
					var doubled = false;
					var redoubled = false;
					var declarer = "";
					var tricks = 0;
					
					var cstr = result;
					
					if (cstr.indexOf("xx")!=-1)
					{
						redoubled = true;
						cstr = cstr.replace("xx","");
					}
					
					if (cstr.indexOf("x")!=-1)
					{
						doubled = true;
						cstr = cstr.replace("x","");
					}
					
					if ((cstr.charAt(0)=="A")|(cstr.charAt(0)=="P"))
					{
						tricks = "";
						declarer = "";
						contract = result;
						
						if (cstr.charAt(0)=="A") numscore = "";	// An average has no associated board score
					}
					else
					{
						level = Number(cstr.charAt(0));
						contract = cstr.substring(0,2);
						
						if (doubled)
							contract = contract + "x";
						else if (redoubled)
							contract = contract + "xx";
							
						declarer = cstr.charAt(2);
						
						if (cstr.indexOf("=")!=-1)
							tricks = 6 + level;
						else if (cstr.indexOf("+")!=-1)
						{
							var idx = cstr.indexOf("+");
							tricks = 6 + level + Number(cstr.charAt(idx+1));
						}
						else
						{
							var idx = cstr.indexOf("-");
							tricks = 6 + level - Number(cstr.substring(idx+1));
						}
					}
					
					var ew = false;
					
					if ((username==east.toUpperCase())|(username==west.toUpperCase()))
						ew = true;
						
					score = "" + score;
						
					if (ew)	// Change score to North/South viewpoint
					{
						if (score.indexOf("%")!=-1)
						{
							score = score.replace("%","");
							score = 100.0 - Number(score);
							score = score + "%";
							
							if (numscore!=="") numscore = -Number(numscore);
						}
						else
						{
							if (!isNaN(score))
							{
								score = -Number(score);
							}
							else
							{
								score = "";
							}
							
							if (numscore!=="") numscore = -Number(numscore);
						}
					}
					
					score = "" + score;
					
					if (score.indexOf("%")!=-1)
						matchpoints = true;
					
					if (isNaN(numscore)) numscore = "";
					
					score = "" + score;
					
					var linlink = movies[i].getElementsByTagName("a")[0];
					
					var board = "";
					var lead = "";
					var lindata = "";
					
					if (linlink.getAttribute("onclick")!=null)
					{
						var str = linlink.getAttribute("onclick").toString();
						var index = str.indexOf('hv_popuplin');
		
						if (index!=-1)
						{
							index = str.indexOf("'");
							str = str.substring(index+1);
							index = str.indexOf("'");
							str = str.substring(0,index);
							
							var names = getLinNames(str);
							
							if (names!=="")
							{
								if (north.toUpperCase()=="GIB") north = names[2];
								if (east.toUpperCase()=="GIB") east = names[3];
								if (south.toUpperCase()=="GIB") south = names[0];
								if (west.toUpperCase()=="GIB") west = names[1];
							}
							
							score = score.replace("%","%25");
							lindata = "qx||" + str + "zz|" + score + "|pg||";
							score = score.replace("%25","%");
								//Extract Board Number
								
							try {
								index = str.indexOf("%7Cah%7C");
								if (index!=-1)
								{
									board = str.substring(index+8);
									
									index = board.indexOf("%7C");
									
									if (index!=-1)
									{
										board = board.substring(0,index);
										board = board.replace("Board%20","");
									}
								}
								
								index = str.indexOf("%7Cpc%7C");
								if (index!=-1)
								{
									lead = str.substring(index+8);
									
									index = lead.indexOf("%7C");
									
									if (index!=-1)
									{
										lead = lead.substring(0,index);
										lead = lead.charAt(1) + lead.charAt(0);
									}
								}							
							} catch (e) {};
						}
					}
					
					lindata = lindata.replace(/,/g,";");
					lindata = lindata.replace(/%7C/g,"|");
					resstr += board + "," + north + "," + south + "," + east + "," + west + "," + result + "," + contract + "," + declarer + "," + tricks + "," + lead + "," + numscore + "," + score + "," + lindata + "\n";
				}
				
				var results = new Object();
				results.date = tdate;
				results.resstr = resstr;
				
				if (ths[1].innerText.indexOf("Some tourneys not shown for security reasons")!=-1)
					results.status = -2;
				else
					results.status = 0;	// Success
				
				if (matchpoints)
					results.scoringType = "MATCH_POINTS";
				else
					results.scoringType = "CROSS_IMPS";
					
				if (resstr.length!=0)
				{
					chrome.runtime.sendMessage({op:"storeResults","para":results,"src":window.location.href},function(){});
					return;
				}
			}
		} catch (e) {};
		
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
					
					if (table.innerText.indexOf("No data found")!=-1)
					{
						var str = "No data on this page. Either data has not been loaded yet, or has been removed from BBO database. ";
						str += "If this is a tournament that has recently ended, wait a few minutes then try again. BBO Extractor will now stop."
						alert(str);
						status = -3;
					}
				}
			}
			var results = new Object();
			results.date = "";
			results.resstr = "";
			results.status = status;
			chrome.runtime.sendMessage({op:"storeResults","para":results,"src":window.location.href},function(){});
		}
	}
	
	function doGrab(pwindow)
	{
		tryBBOLinFiles(pwindow);
	}
	
	doGrab(this);
})();
