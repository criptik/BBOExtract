(function(){
	var g_found = false;
	var bbo_ranking  = new Array();
	var bbo_headers = "";
	var bbo_links = new Array();
	var g_index = 0;
	var g_swissTeams = false;
	var g_scoreMissing = false;	// Sometimes Teams of Four Extraction tournament page may have missing score(s)
	var g_teamID = 1;	// Incremented for every team on Swiss Teams ranking list
	
	var g_hands = new Object();
	g_hands.boards = new Array();
	
	var g_linstr = "";
	var g_lindex = 0;
	var g_lincount = 0;
	var g_hrefs = [];
	
	var g_teams = new Array();
	var g_tlines = new Array();
	
	function setResultComponents(resultcell,tline)
	{
			// Sometimes results on a Team tournament page have been known to erroneously show with reversed
			// polarity. This function checks whether this is the case.
		var shouldReverse = false;
		
		var result = resultcell.innerText;
		
		if (result.trim().length==0)
			g_scoreMissing = true;
		
		result = result.replace(/\u2660/,"S");
		result = result.replace(/\u2665/,"H");
		result = result.replace(/\u2666/,"D");
		result = result.replace(/\u2663/,"C");
		
		var numscorecell = resultcell.nextSibling;
		var numscore = numscorecell.innerText;
		
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
			
			if (tricks>=(6+level)) // Contract Made
			{
				if (((declarer=="N")|(declarer=="S"))&(Number(numscore)<0)) shouldReverse = true;
				if (((declarer=="E")|(declarer=="W"))&(Number(numscore)>0)) shouldReverse = true;
			}
			else if ((declarer=="E")|(declarer=="W"))	// Contract went off, so should be +ve to NS
			{
				if (Number(numscore)<0) shouldReverse = true;
			}
			else if ((declarer=="N")|(declarer=="S"))	// Contract went off, so should be -ve to NS
			{
				if (Number(numscore)>0) shouldReverse = true;
			}
		}
		
		tline.result = result;
		tline.contract = contract;
		tline.declarer = declarer;
		tline.tricks = tricks;
		
		return shouldReverse;
	}
	
	function getLinData(resultcell,score)
	{
		var linlink = resultcell.getElementsByTagName("a")[0];
		
		var board = "";
		var lead = "";
		var lindata = "";
		
		if (linlink.getAttribute("href")!=null)
		{
			var href = linlink.href;
			
			var index = href.indexOf('&lin=');

			if (index!=-1)
			{
				var str = href.substring(index+5);
				lindata = "qx||" + str + "zz|" + score + "|pg||";

					// Extract Lead Card
				index = lindata.indexOf("%7Cpc%7C");
				if (index!=-1)
				{
					lead = lindata.substring(index+8);
					
					index = lead.indexOf("%7C");
					
					if (index!=-1)
					{
						lead = lead.substring(0,index);
						lead = lead.charAt(1) + lead.charAt(0);
					}
				}			
			}
		}
		
		lindata = lindata.replace(/,/g,";");
		lindata = lindata.replace(/%7C/g,"|");
		
		var result = new Object();
		result.lin = lindata;
		result.lead = lead;
		
		return result;
	}
	
	function getTeamName(rows,pnames)
	{
		var teamName = "";
		
		try {
			for (var i=rows.length-2;i<rows.length;i++)
			{
				var tname = rows[i].cells[0].innerText;
				
				var players = rows[i].cells[1].innerText;
				var player = players.split("-")[0];
				player = player.trim().toUpperCase();
				
				for (var j=0;j<pnames.length;j++)
				{
					if (player==pnames[j].toUpperCase())
					{
						tname = tname.replace(/[^A-Za-z0-9_ \-]/g,"");
						return tname;
					}
				}
			}
		} catch (err) {};
		
		return teamName;
	}
	
	function extractTeamsData(pwindow,hTable,sections,handrecords)
	{
		var rows = hTable[0].rows;
		var reverse = false;	// Set to true if page requested by an EW user
		var tuser = "";	// Username of user in &u= para on tournament url
		var userNameMatchedInURL = false; // If true, polarity of the results is from the point of view of this user
		
		var url = pwindow.location.href;
		var idx = url.indexOf("&u=");
		
		if (idx!=-1)
		{
			var str = url.substring(idx+3);
			
			idx = str.indexOf("&");
			
			if (idx!=-1)
				str = str.substring(0,idx);
				
			tuser = str.toUpperCase().replace(/%20/g," ").replace(/\+/g," ");
		}
		
		if (rows.length>1)	// Extract Team names and player names
		{
			var ptable = handrecords[0].querySelectorAll("table.players");
			
			var trows1 = ptable[0].rows;
			var trows2 = ptable[1].rows;
			
			var table1Names = new Array();
			table1Names[0] = trows1[1].cells[1].innerText.trim();  // North
			table1Names[1] = trows1[3].cells[1].innerText.trim();  // South
			table1Names[2] = trows2[2].cells[2].innerText.trim();  // East
			table1Names[3] = trows2[2].cells[0].innerText.trim();  // West
			
			var table2Names = new Array();
			table2Names[0] = trows2[1].cells[1].innerText.trim();  // North
			table2Names[1] = trows2[3].cells[1].innerText.trim();  // South
			table2Names[2] = trows1[2].cells[2].innerText.trim();  // East
			table2Names[3] = trows1[2].cells[0].innerText.trim();  // West
			
			if (tuser!=="")
			{
				for (var i=0;i<4;i++)
				{
					if ((tuser==table1Names[i].toUpperCase())|(tuser==table2Names[i].toUpperCase()))
					{
						userNameMatchedInURL = true;
						break;
					}
				}
				
				if ((tuser==table1Names[2].toUpperCase())|(tuser==table1Names[3].toUpperCase())|(tuser==table2Names[2].toUpperCase())|(tuser==table2Names[3].toUpperCase()))
				{
					reverse = true;
				}
			}
			
			var t = new Object();
			t.teamID = 1;
			t.teamName = getTeamName(rows,table1Names);
			t.players = table1Names;
			g_teams.push(t);

			t = new Object();
			t.teamID = 2;
			t.teamName = getTeamName(rows,table2Names);
			t.players = table2Names;
			g_teams.push(t);
		}
		
			// Now get the traveller line details
		var boards = handrecords[0].querySelectorAll("td.boardcell");
		
			// If necessary, check whether results polarity is correct
		if (!userNameMatchedInURL)
		{
			for (var i=0;i<boards.length;i++)
			{
				var board = boards[i];
				var resultcell = board.nextSibling;
				var tline = new Object();
				
				if (setResultComponents(resultcell,tline))	// Polarity of results needs to be reversed
				{
					reverse = true;		// At least one board result present, and reversed, so they must all be
					break;
				}
			}
		}
		
		for (var i=0;i<boards.length;i++)
		{
			var board = boards[i];

			var tline = new Object();
			
			tline.board = board.innerText;
			tline.team = 1;
			tline.oppTeam = 2;
			
				// For now, assume players are as per lineup on tournament page (may override
				// later, based on names in playdata)
			var t1players = g_teams[0].players;
			var t2players = g_teams[1].players;
			
			tline.north = t1players[0];
			tline.south = t1players[1];
			tline.east =  t2players[2];
			tline.west =  t2players[3];
			
			var resultcell = board.nextSibling;
			
			setResultComponents(resultcell,tline);
			
			var numscorecell = resultcell.nextSibling;
			var numscore = numscorecell.innerText;
			
			if (reverse)	// Scores are reversed because scores on tournament page were presented from EW viewpoint
				numscore = "" + (-Number(numscore));
			
			tline.numscore = numscore;
			
			var t1scorecell = numscorecell.nextSibling;
			var t2scorecell = t1scorecell.nextSibling;
			
			var t1score = t1scorecell.innerText;
			var t2score = t2scorecell.innerText;
			
			if ((t1score=="")&(t2score==""))
				t1score = t2score = "0";
			else if (t1score!="")
				t2score = "" + (-Number(t1score));
			else
				t1score = "" + (-Number(t2score));
				
			if (reverse)	// Scores are reversed because scores on tournament page were presented from EW viewpoint
			{
				t1score = "" + (-Number(t1score));
				t2score = "" + (-Number(t2score));
			}
				
			tline.score = t1score;
			
			var linres = getLinData(resultcell,tline.score);
			tline.lead = linres.lead;
			tline.lin = linres.lin;
			
			g_tlines.push(tline);
			
			var tline = new Object();
			
			var board = boards[i];
			tline.board = board.innerText;
			tline.team = 2;
			tline.oppTeam = 1;
			
			tline.north = t2players[0];
			tline.south = t2players[1];
			tline.east =  t1players[2];
			tline.west =  t1players[3];
			
			resultcell = t2scorecell.nextSibling;
			
			setResultComponents(resultcell,tline);
			
			var numscorecell = resultcell.nextSibling;
			var numscore = numscorecell.innerText;
			
			if (reverse)	// Scores are reversed because scores on tournament page were presented from EW viewpoint
				numscore = "" + (-Number(numscore));

			tline.numscore = numscore;
			
			tline.score = t2score;
			
			linres = getLinData(resultcell,tline.score);
			tline.lead = linres.lead;
			tline.lin = linres.lin;

			g_tlines.push(tline);
		}
			
		var data = new Object();
		data.headers = bbo_headers;
		
		chrome.runtime.sendMessage({op:"storeRanking","para":data,"src":window.location.href});
		
		data = new Object();
		data.teams = g_teams;
		data.tlines = g_tlines;
		
		if (g_scoreMissing)
			alert("!!!! One or more lines has a missing contract/score. Please correct this in BBOtoXML after extraction");
		
		chrome.runtime.sendMessage({op:"storeTeamsData","para":data,"src":window.location.href});
	}
	
	function getStrats(th)
	{
		var strats = new Array();
		
		try {		
			var table = th.querySelectorAll("table");
			
			if (table.length==0) return strats;
			
			var rows = table[0].rows;
			var cells = rows[0].cells;
			
			for (var i=0;i<cells.length;i++)
			{
				strats.push(cells[i].innerText);
			}
		} catch (err) {}
			
		return strats;
	}
	
	function getStratum(tr,strats)
	{
		var stratum = "";
		
		try {		
			var table = tr.querySelectorAll("table");
			
			if (table.length==0) return stratum;
			
			var rows = table[0].rows;
			var cells = rows[0].cells;
			
			for (var i=cells.length-1;i>=0;i--)
			{
				if (cells[i].innerText.trim().length!=0)
				{
					stratum = strats[i];
					break;
				}
			}
		} catch (e) {}
			
		return stratum;
	}
	
	function storeFields(rline,name,score,stratum,section,pts)
	{
		rline.name = name;
		rline.score = score;
		rline.stratum = stratum;
		rline.section = section;	// BBO Section number of this pair
		rline.pts = pts;
	}

	function tryBBOTournamentResults(pwindow)
	{
		try {
			var hTable = pwindow.document.querySelectorAll("table.bbo_t_l");
			var sections = pwindow.document.querySelectorAll("div.onesection");
			
			if (sections.length==0)
			{
				sections = pwindow.document.querySelectorAll("div.bbo_tr_o");
				g_swissTeams = true;
			}
			
			var hrecsPresent = false;
			
			if (sections.length>0)
			{
				var handrecords = sections[0].querySelectorAll("table.handrecords");
				
				if (handrecords.length>0)
					hrecsPresent = true;
			}
						
			if (hTable.length>0)
			{
				var rows = hTable[0].querySelectorAll("tr");
				
				for (var i=0;i<rows.length;i++)
				{
					var found = false;
					var tds = rows[i].querySelectorAll("td");
					
					for (var j=0;j<tds.length;j++)
					{
						if ((j==0)&((tds[j].innerText=="Title")|(tds[j].innerText=="Host")|(tds[j].innerText=="Tables")))
						{
							found = true;
						}
						
						if (!found) continue;
						
						var str = tds[j].innerText;
						str = str.replace(/\"/g,"");
						
						if (j==0) bbo_headers += "#";
						bbo_headers += str;
							
						if (j<tds.length-1)
							bbo_headers += ",";
						else
							bbo_headers += "\n";
					}
				}
			}
			
			if (sections.length>0)
			{
				if (handrecords.length>0)
				{
					extractTeamsData(pwindow,hTable,sections,handrecords);
					return 0;
				}
			}
			
			for (var i=0;i<sections.length;i++)
			{
				var table = sections[i].getElementsByTagName("table");
				var rows = table[0].rows;

				var rsection = new Object();
				var cursec = sections[i];
				var title = "";
				
				if (!g_swissTeams)
				{
					var titlediv = cursec.previousSibling;
					title = titlediv.innerText;
				}
				else
				{
					title = "Teams Ranking";
				}
				
				var ew = (title.indexOf("E/W")!=-1);
				
				var sectionNumber = 0;
				var direction = "";
				
				var secidx = title.indexOf("Section");

				if (secidx!=-1)
				{
					var str = title.substring(secidx+8);
					str = str.substring(0,2);	// Allow for 2 digit section number
					sectionNumber = Number(str);
				}
				
				if (title.indexOf("N/S")!=-1)
					direction = "NS";
				else if (title.indexOf("E/W")!=-1)
					direction = "EW";
				else
					direction = "Both";
					
				var rheader = "#Ranking," + title + "," + sectionNumber + "," + direction + "\n";
//				alert(rheader);								

				var rlines = new Array();
				var teams = new Array();	// Used if Swiss Teams
				
				var rankidx = -1;
				var nameidx = -1;
				var scoreidx = -1;
				var ptsidx = -1;
				
					// Get the Table Headers to find column names
				var ths = cursec.getElementsByTagName("th");
				
				for (var j=0;j<ths.length;j++)
				{
					if (ths[j].innerText.toUpperCase().indexOf("NAME")!=-1)
						nameidx = j;
					else if (ths[j].innerText.toUpperCase().indexOf("RANK")!=-1)
						rankidx = j;
					else if (ths[j].innerText.toUpperCase().indexOf("SCORE")!=-1)
						scoreidx = j;
					else if (ths[j].innerText.toUpperCase().indexOf("POINTS")!=-1)
						ptsidx = j;
				}
				
				var strats = new Array();
				
				if (rankidx!=-1)
					strats = getStrats(ths[rankidx]);
					
				var scol = "";
				
				if (strats.length!=0)
					scol = ",Stratum";
				
				rheader += "#Rank,Name,Score,pair,ID1,ID2,BBO Pts,Section" + scol + "\n";
				rsection.header = rheader;

				var ranking = "";
				
					// Omit the Header Row
				for (var j=1;j<rows.length;j++)
				{
					var rline = new Object();
					var tds = rows[j].getElementsByTagName("td");
					
					if (tds.length==0) continue;	// Must be Header Row
					
					var name = tds[nameidx].innerText;
					var score = tds[scoreidx].innerText;
					
					var stratum = "";
					
					if (strats.length!=0)
						stratum = getStratum(tds[rankidx],strats);
					
					var ref = tds[scoreidx].querySelector("a");
					
					if (ref!=null)
					{
						var lnk = ref.href;
						
						var lnkObject = new Object();
						lnkObject.section = sectionNumber;
						lnkObject.lnk = lnk;
						
							// Need to store links for both NS and EW because sometimes a North or East player is substituted
							// for some boards and this can mean their results do not appear in the scorecard for the main Morth or East player 
						bbo_links.push(lnkObject);
					}
					
					//rline.rank = rank;
					
					var pts = rows[j].querySelectorAll("td.pts");
					
					if (pts.length>0)
						pts = pts[0].innerText;
					else if (ptsidx!=-1)
						pts = tds[ptsidx].innerText;
					else
						pts = "";
						
					if (!g_swissTeams)
					{
						storeFields(rline,name,score,stratum,sectionNumber,pts);
						rlines.push(rline);
					}
					else
					{
						var pnames = name.split(",");
						var nsnames = pnames[0];
						var ewnames = pnames[1];
						
						storeFields(rline,nsnames,score,stratum,sectionNumber,pts);
						rlines.push(rline);
						
						var rline = new Object();
						storeFields(rline,ewnames,score,stratum,sectionNumber,pts);
						rlines.push(rline);
					}
				}
				
				rsection.ranking = rlines;
				rsection.section = sectionNumber;
				rsection.direction = direction;
				bbo_ranking.push(rsection);
			}
			
			var data = new Object();
			data.headers = bbo_headers;
			
			data.rank = bbo_ranking;
			data.isSwissTeams = g_swissTeams;
			
			chrome.runtime.sendMessage({op:"storeRanking","para":data,"src":window.location.href});
			
			if (bbo_links.length!=0)
			{
				chrome.runtime.sendMessage({op:"storeBBOLinks","para":bbo_links,"src":window.location.href});
				bbo_links = new Array();
				return 0;	// success, with links
			}
			else
			{
				return 1;	// right sort of page, but no links on page
			}
		} catch (err) {return -1;}
	}
	
	function runScript(pwindow)
	{
		return tryBBOTournamentResults(pwindow);
	}
	
	var result = runScript(this);
	return result;
})();
