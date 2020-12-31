var g_bboTab = 0;
var g_teamEvent = false;
var g_swissTeams = false;
var g_bboLinks = new Array();
var g_travLinks = new Array();
var g_activeLinks;
var g_lastUrl = "";
var g_getTravLinks = false;
var g_travellerMode = false;	// Set to true when using travellers rather than scorecards
var g_running = false;
var g_index = 0;
var g_csv = "";
var g_date = "";		// Extracted from scorecard
var g_initialTitle = "BBO Extractor\n\n- Click to extract results from a BBO Tournament Page";
var g_tournament = "";
var g_tournErr = "No tournament page in active browser tab - url must be of the form: http://webutil.bridgebase.com/v2/tview.php?t=<hyphenated tournament number>";
var g_retryCount = 0;
var g_retryLimit = 10;

var g_rankingData = new Object(); // Holds ranking data for all Sections
var g_tlines = new Array();
var g_teams = new Array();
var g_pairNames = new Array();
var g_alias = new Array();
var g_ID = new Array();
var g_boardsRead = new Array();
var g_scoringType = "MATCH_POINTS";
var g_winners = 1;	// Can be one or two winner event
var g_highestNSPairNumber = 0;
var g_highestRealPair = 0;	// All pair numbers above highest RealPair are considered to be substitutes

var g_hands = new Object();

var g_delay=100;
var g_retryDelay = 1000;

setBBXOff();

	// Define startsWith function in case javascript doesn't support it
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

chrome.tabs.onUpdated.addListener(function (tabId,info,tab) {
	if (g_bboTab==tabId)
	{
		if (info.status=="complete")
		{
			if (!g_getTravLinks)
			{
				if (g_bboTab!=0)
				{
					setTimeout(function(){chrome.tabs.executeScript({
						file:'bbo_extract.js',allFrames:true
					});},500);
				
					g_bboTab = 0;
				}
			}
			else
			{
				setTimeout(function(){chrome.tabs.executeScript({
					file:'bbo_travellerlinks.js',allFrames:true
				});},500);
			
				g_bboTab = 0;
			}
		}
	}
})

function setBBXOn()
{
	g_running = true;
	chrome.browserAction.setIcon({path: "icon2.png"});
	chrome.browserAction.setTitle({title:"Click to stop BBO Extractor"});
	
}

function setBBXOff()
{
	g_running = false;
	chrome.browserAction.setIcon({path: "icon.png"});
	chrome.browserAction.setTitle({title:g_initialTitle});
	chrome.notifications.clear("1");
}

chrome.browserAction.onClicked.addListener(function(event) {
	// Intercept event triggered by user clicking on the BBO Extractor icon at the right hand side of the address bar.
	var tab = event.id;
	var url = event.url;
	var i;
	
	if (g_running)
	{
		g_running = false;
		setBBXOff();
		return;
	}
	
	setBBXOn();
	
	g_csv = "";
	g_tlines = new Array();
	g_pairNames = new Array();
	g_teams = new Array();
	g_alias = new Array();
	g_ID = new Array();
	g_scoringType = "MATCH_POINTS";		// Initial assumption
	g_winners = 1;	// Initial assumption
	g_highestNSPairNumber = 0;
	g_highestRealPair = 0;		
	g_hands = new Object();
	var boards = new Array();
	g_hands.boards = boards;
	g_boardsRead = new Array();
	g_travellerMode = false;	// Assume scanning scorecards rather than travellers
	g_getTravLinks = false;
	g_teamEvent = false;
	g_swissTeams = false;
	g_retryCount = 0;
	g_date = "";
	
	var manifestData = chrome.runtime.getManifest();
	g_csv += "#ProgramName,BBO Extractor\n";
	g_csv += "#Version," + manifestData.version + "\n";
	
	if (url==null)
	{
        alert(g_tournErr);
        setBBXOff();
	    return;
	}

	var idx = url.indexOf("?t=");
	
	if (idx!=-1)
	{
		var str = url.substring(idx+3);
		
		idx = str.indexOf("&");
		
		if (idx!=-1)
			str = str.substring(0,idx);
		
		g_tournament = str;
	}
	
    chrome.tabs.query( {} ,function (tabs) { // The Query {} was missing here
    for (var i = 0; i < tabs.length; i++) {
		var i;
		
      chrome.tabs.executeScript(tabs[i].id, {file: "get_name_conversion_table.js"});
    }
  });
  
  var opt = {
  "type": "basic",
  "title": "BBO Extractor",
  "message": "Running",
  "iconUrl": "icon128.png",
  "requireInteraction":true
  };
  
  chrome.notifications.create("1", opt);
  
	try {
		var jsfile = 'bbo_tournament.js';
		
//		if (url.endsWith(".xml")) jsfile = 'bbo_xml.js';
		
		chrome.tabs.executeScript({
				file:jsfile
			},function (results){
				if ((typeof results)!=="undefined")
				{
					if (results.length>=1)
					{
						if ((typeof results[0])=="undefined")
						{
							alert(g_tournErr);
							setBBXOff();
						}
						else if (results[0]!=0)
						{
							alert(g_tournErr);
							setBBXOff();
						}
					}
				}
				else
				{
					alert(g_tournErr);
					setBBXOff();
				}
			})
	} catch (err) {alert(g_tournErr);setBBXOff();};
});

	// Handler to process messages from injected scripts.
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	var finished = false;
	
	if (request.op=="storeResults")
	{
		if (!g_running)
		{
			chrome.tabs.remove(sender.tab.id);
			return;
		}
	}
	
	if (!g_running) return;
	
	if (request.op=="storeBBOLinks")
	{
		g_bboLinks = request.para;
		g_index = 0;
		
			// Get Traveller Page
		g_getTravLinks = true;
		
		var lnk = "https://www.bridgebase.com/myhands/hands.php?tourney=" + g_tournament + "-";
		g_lastUrl = lnk;
		
		g_retryCount = 0;
		
		chrome.tabs.create({url:lnk},function(tab) {
			g_bboTab = tab.id;
		});
	}
	else if (request.op=="travellerLinks")	// Store the traveller links and start requesting them
	{
		chrome.tabs.remove(sender.tab.id);
		
		g_getTravLinks = false;
		g_travLinks = request.para;
		g_index = 0;
		
			// Always use traveller mode rather than scanning scorecards, otherwise there is a remote possibility of missing some scores if a 
			// pair of substitutes who are not in the ranking list play another pair of substitutes who are
			// also not in the ranking list.
		g_activeLinks = g_travLinks;
		g_travellerMode = true;	
		
			// Get Traveller Page
		var lnk = g_activeLinks[g_index].lnk;
		g_lastUrl.replace("http:","https:");
		lnk = lnk + "&offset=0";
		g_lastUrl = lnk;
		
		g_retryCount = 0;
		
		chrome.tabs.create({url:lnk},function(tab) {
			g_bboTab = tab.id;
		});
	}
	else if (request.op=="getTravLinksFailed")
	{
		chrome.tabs.remove(sender.tab.id);
		
		var status = request.para.status;
		
		if (g_teamEvent)
		{
			if ((status==-2)|(status==-3))
			{
				alert("Unable to retrieve date for this event. Using current date. Please edit the #Date row in the csv file to substitute the correct date for the event");
				finished = true;
			}
		}
		else if (status==-2)
		{
			alert("Tournament scorecards/travellers for this tournament are blocked by BBO. Results retrieval by BBO Extractor is not possible !");
			setBBXOff();
			return;
		}
		else if (status==-3)
		{
			setBBXOff();
			return;			
		}
		
		g_retryCount++;
		
		if (g_retryCount<g_retryLimit)
		{
				// status must have been -1, so request is retryable
			setTimeout(function(){if (!g_running) return;chrome.tabs.create({url:g_lastUrl},function(tab) {
				g_bboTab = tab.id;
			});},g_retryDelay);
		}
		else if (g_teamEvent)
		{
			alert("Unable to retrieve date for this event. Using current date. Please edit the #Date row in the csv file to substitute the correct date for the event");
			finished = true;
		}
		else
		{
			alert("No traveller links available - giving up !");
			setBBXOff();
			return;
		}
	}
	else if (request.op=="storeResults")
	{
		chrome.tabs.remove(sender.tab.id);
		
			// Clear cookies to ensure a new session for next request (may be needed to prevent caching)
		try {
			chrome.cookies.remove({url:"https://bridgebase.com",name:"SRV"});
			chrome.cookies.remove({url:"https://www.bridgebase.com",name:"PHPSESSID"});
		} catch (err) {}

		var resstr = request.para.resstr;
	
		if ((request.para.date!=="")&(g_date==""))
		{
			g_date = correctedDate(request.para.date);	// Store date from traveller, if available
		}
		
		if (g_teamEvent)
		{
			if ((request.para.status==-2)|(request.para.status==-3))
			{
				alert("Unable to retrieve date for this event. Please edit the csv file to set the correct date for the event");
			}
		}
		else if (request.para.status==0)
		{
			if (resstr.length>0)
			{
				g_scoringType = request.para.scoringType;
				storetlines(resstr);
			}
			
			g_retryCount = 0;
			g_index++;
		}
		else if (request.para.status==-2)
		{
			alert("Tournament scorecards/travellers for this tournament are blocked by BBO. Results retrieval by BBO Extractor is not possible !");
			setBBXOff();
			return;
		}
		else if (request.para.status==-3)
		{
			setBBXOff();
			return;
		}
		
		if (((g_index<g_activeLinks.length)&!g_teamEvent)|(g_teamEvent&request.para.status==-1))
		{
			g_retryCount++;
			
			if (g_retryCount>g_retryLimit)
			{
				alert("No data on traveller page. The detailed results may be embargoed or may not have been published yet. Giving up !");
				setBBXOff();
				return;
			}
			else
			{
				g_lastUrl = g_activeLinks[g_index].lnk;
				g_lastUrl.replace("http:","https:");
				g_lastUrl += "&offset=0";
				
				var delay = g_delay;
				
				if (g_retryCount>1)
					delay = g_retryDelay;
					
				setTimeout(function(){if (!g_running) return;chrome.tabs.create({url:g_lastUrl},function(tab) {
					g_bboTab = tab.id;
				});},delay);
			}
		}
		else
		{
			finished = true;
		}
	}
	else if (request.op=="storeRanking")
	{
		g_rankingData = request.para;
		g_swissTeams = g_rankingData.isSwissTeams;
		g_csv += g_rankingData.headers;
	}
	else if (request.op=="storeTeamsData")
	{
		g_teams = request.para.teams;
		g_tlines = request.para.tlines;
		
		for (var i=0;i<g_tlines.length;i++)
		{
			var tline = g_tlines[i];
			convertLinNames(tline);
		}
		
		g_teamEvent = true;
		
			// Need to get traveller page, just to find link to first traveller, which should have
			// event date
		g_getTravLinks = true;
		
		var lnk = "https://www.bridgebase.com/myhands/hands.php?tourney=" + g_tournament + "-";
		g_lastUrl = lnk;
		
		chrome.tabs.create({url:lnk},function(tab) {
			g_bboTab = tab.id;
		});
	}
	else if (request.op=="names")
	{
//		alert("Names Conversion Table Loaded");
		storeNameConversion(request.para);
	}
	
	if (finished)
	{
		if (!g_teamEvent)
		{
			processResults();
		}
		else
		{	
			processTeamsData();
			setBBXOff();
		}
		
		g_hands.boards.sort(function(a,b){
				if (Number(a.board)>Number(b.board)) return 1;
				else if (Number(a.board)<Number(b.board)) return -1;
				else {
					if (a.nspair>b.nspair) return 1;
					else if (a.nspair<b.nspair) return -1;
					else return 0;
				}
		});
		
		
		var filename = getFilename();
		
		alert("Finished - Data will now be downloaded to a csv file in browser Downloads folder. The PBN file will be downloaded when makeable contracts have been calculated.");
		post("https://dds.bridgewebs.com/bboextractor/echocsv.php",g_csv,filename)
		post("https://dds.bridgewebs.com/bboextractor/calldd.php",JSON.stringify(g_hands),filename);
		setBBXOff();
	}
  }
);

function getPlayerNumber(team,name)
{
	var players = team.players;
	
	var found = false;
	
	for (var i=0;i<players.length;i++)
	{
		if (players[i]==name)
		{
			return i+1;
		}
	}
	
	if (!found)
	{
		team.players.push(name);
		return team.players.length;
	}
}

function getTeamPair(tline,dir)
{
	var tid = tline.team;
	var p1 = "";
	var p2 = "";
	
	if (dir=="NS")
	{
		var name1 = tline.north;
		var name2 = tline.south;
		
		var team = g_teams[Number(tid) - 1];
		p1 = getPlayerNumber(team,name1);
		p2 = getPlayerNumber(team,name2);
	}
	else if (dir=="EW")
	{
		var name1 = tline.east;
		var name2 = tline.west;
		
		var team;
		
		if (Number(tid)==1)
		{
			tid = 2;
			team = g_teams[1];
		}
		else
		{
			tid = 1;
			team = g_teams[0];
		}

		p1 = getPlayerNumber(team,name1);
		p2 = getPlayerNumber(team,name2);
	}
	
	return "P" + tid + "-" + p1 + "-" + p2;
}

function assignTeamPlaces()
{
	var current = 0;
	var prevscore = "";
	
	for (var i=0;i<g_teams.length;i++)
	{
		var team = g_teams[i];
		
		if (team==prevscore)
		{
			team.rank = current;
			g_teams[i-1].rank = team.rank;
		}
		else
		{
			team.rank = 1+i;
			current = team.rank;
		}
		
		prevscore = team.score;
	}
}

function processTeamsData()
{
		// Compute total IMPs for each team
	for (var i=0;i<g_teams.length;i++)
	{
		var team = g_teams[i];
		team.imps = 0;

		for (var j=0;j<g_tlines.length;j++)
		{
			var tline = g_tlines[j];
			
			if (tline.team==team.teamID) team.imps += Number(tline.score);
		}
	}
	
	g_teams.sort(function(a,b){
						if (Number(a.imps)>Number(b.imps)) return -1;
						else if (Number(a.imps)<Number(b.imps)) return 1;
						else return 0;
						}
				);
	
	assignTeamPlaces();

	var bdnums = new Array();
	
	for (var i=0;i<g_tlines.length;i++)
		bdnums[g_tlines[i].board]=1;
		
	var nboards = Object.keys(bdnums).length;
	
	if (g_date=="") g_date = currentDate();
	
	g_csv += "#BoardCount," + nboards + "\n";
	g_csv += "#Tournament," + g_tournament + "," + "https://webutil.bridgebase.com/v2/tview.php?t=" + g_tournament + "\n";
	g_csv += "#Date," + g_date + ",Date:" + g_date + "\n";
	g_csv += "#ScoringType,IMPS\n";
	g_csv += "#Ranking,TEAMS\n";
	g_csv += "#Rank,Team,Imps,TeamName,Name1,Name2,Name3,Name4,ID1,ID2,ID3,ID4\n"
	
	for (var i=0;i<g_teams.length;i++)
	{
		var team = g_teams[i];
		var players = team.players;
		
		g_csv += team.rank + "," + team.teamID + "," + team.imps + "," + team.teamName + ",";
		g_csv += lookupAlias(players[0]) + "," + lookupAlias(players[1]) + "," + lookupAlias(players[2]) + "," + lookupAlias(players[3]) + ",";
		g_csv += lookupID(players[0]) + "," + lookupID(players[1]) + "," + lookupID(players[2]) + "," + lookupID(players[3]);
		g_csv += "\n";
	}
	
	g_csv += "#TravellerLines\n";
	g_csv += "#Board,North,South,East,West,Result,Contract,Declarer,Tricks,Lead,Score,Imps,nsXimps,ewXimps,calcPercent,nsPair,ewPair,section,playdata" + "\n";
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var tline = g_tlines[i];
		
		storeBoard(tline.lin);
		
			// Get pair numbers for the players.
		var nspair = "NS" + tline.team;
		var otherteam = "";
		
		if (tline.team==1)
			otherteam = 2;
		else
			otherteam = 1;
			
		var ewpair = "EW" + otherteam;
		
		g_csv += tline.board + "," + lookupAlias(tline.north) + "," + lookupAlias(tline.south) + "," + lookupAlias(tline.east) + "," + lookupAlias(tline.west) + ",";
		g_csv += tline.result + "," + tline.contract + "," + tline.declarer + "," + tline.tricks + ",";
		g_csv += tline.lead + "," + tline.numscore + "," + tline.score + "," + "" + "," + "" + "," + "" + "," + nspair + "," + ewpair + "," + "1" + "," + "\"" + tline.lin.replace(/;/g,",") +"\"" + "," + tline.tdate + "\n";
	}
}

function getFilename()
{
	var fname = "tournament";
	var header = g_rankingData.headers.split("\n");
	
	for (var i=0;i<header.length;i++)
	{
		if (header[i].startsWith("#Title"))
		{
			fname = header[i].substring(1);
			
			var idx = fname.indexOf("#");
			
			if (idx!=-1)
			{
				fname = fname.substring(idx+1).trim();
				fname = fname.replace(/ /g,"_") + "_" + g_date;
				break;
			}
		}
	}
	
	return fname;
}

function lookupAlias(alias)
{
	if ((typeof g_alias[alias.toUpperCase()])==="undefined")
		return alias;
	else
		return g_alias[alias.toUpperCase()];
}

function storeAlias(alias,name)
{
	g_alias[alias.toUpperCase()] = name;
}

function lookupID(alias)
{
	if ((typeof g_ID[alias.toUpperCase()])==="undefined")
		return "";
	else
		return g_ID[alias.toUpperCase()];
}

function storeID(alias,ID)
{
	g_ID[alias.toUpperCase()] = ID;
}

function storeNameConversion(data)
{
	data = data.split("\n");
	
	for (var i=1;i<data.length;i++)	// ignore the first line - it is a header
	{
		if (data[i].trim()=="") continue;	// Ignore blank lines
		if (data[i].trim().startsWith("#")) continue; // Ignore comment lines
		
		var namepair = data[i].split(",");
		
		try {
			storeAlias(namepair[0].trim(),namepair[1].trim()+ " " + namepair[2].trim());
			if (namepair.length>3) storeID(namepair[0].trim(),namepair[3].trim());
		} catch (e) {alert("Wrongly formatted line " + (i+1) + " in names file ignored: " + data[i]);}
	}
}

function notRobot(name)
{
	var isnotr = false;
	name = name.toUpperCase();
	
	if ((name!="ROBOT")&(name!="GIB")&(!name.startsWith("~~")))
		isnotr = true;
	
	return isnotr;
}

function isRobot(name)
{
	return !notRobot(name);
}

function isNonUniqueRobot(name)
{
	var isr = false;
	name = name.toUpperCase();
	
	if ((name=="ROBOT")|(name=="GIB"))
		isr = true;
	
	return isr;
}

function isNonUniqueRobotPair(name1,name2)
{
	var isr = false;
	
	if (isNonUniqueRobot(name1)&isNonUniqueRobot(name2))
	{
		isr = true;
	}
	
	return isr;
}

function countRobotPairs()
{
	var count = 0;
	var pair = 0;
	
	for (var i=0;i<g_highestRealPair;i++)
	{
		var names = g_pairNames[i];
		
		for (var j=0;j<names.length;j++)
		{
			if (names[j].toUpperCase()=="ROBOT+ROBOT")
			{
				count++;
				pair = i+1;
				break;
			}
		}
	}
	
	var result = new Object();
	result.count = count;
	result.pair = pair;
	
	return result;
}

function nameMatch(name1,name2)
{
	if (name1.toUpperCase()==name2.toUpperCase())
		return true;
	else
		return false;
}

function isSitoutPair(names)
{
	if (names.toUpperCase().indexOf("~SITOUT")!=-1)
		return true;
	else
		return false;
}

function isSitoutTable(tline)
{
	if (isSitoutPair(tline.north + "+" + tline.south)|isSitoutPair(tline.east + "+" + tline.west))
		return true;
	else
		return false;
}

function getPairNumber(pname,canAdd,matchSubsOnly)
{
	if (isSitoutPair(pname))
		return 0;
	
	var name = pname.split("+");
	
	var robotPair = isNonUniqueRobotPair(name[0],name[1]);
	
	if ((robotPair)&!matchSubsOnly)	// All robot pairs have the same name in the ranking list, need to create a new pair number for each robot pair in the ranking list
	{
		if (canAdd)	// Being called from ranking list, create a new entry for each pair
		{
			var names = new Array();
			names.push("ROBOT+ROBOT");
			g_pairNames.push(names);
			g_highestRealPair = g_pairNames.length;	
			return g_pairNames.length;
		}
		else	// Attempt to deal with this automatically if there is only one robot pair in the list
		{		// Will already have checked there is only one robot pair in the traveller
			var result = countRobotPairs();
			
			if (result.count==1)
				return result.pair;
				
			// else will be assigned a "Sub" pair below.
		}
	}
	
	var offset = 0;
	
	if ((robotPair)|matchSubsOnly)	// Don't attempt to match robot pair against real pair numbers, it has already been done.
		offset = g_highestRealPair;
		
		// Is this exact pair of names already recorded ?
	for (var j=offset;j<g_pairNames.length;j++)
	{
		var pnames = g_pairNames[j];
		
		for (var k=0;k<pnames.length;k++)
		{
			var targ = pnames[k].split("+");
			
			if ((nameMatch(name[0],targ[0])&nameMatch(name[1],targ[1]))|(nameMatch(name[1],targ[0])&nameMatch(name[0],targ[1])))
			{
					// return the matching pair number, whether it's a real pair number or a sub
				if ((1+j)>g_highestRealPair)
					return "Sub" + (1+j);
				else
					return 1+j;
			}
		}
	}
	
		// There was no exact match - attempt to find a pair with one matching name
	for (var j=offset;j<g_pairNames.length;j++)
	{
		var pnames = g_pairNames[j];
		
		for (var k=0;k<pnames.length;k++)
		{
			var targ = pnames[k].split("+");
			
			var found = false;
			var replace = false;
			
			if ((k==0)&((j+1)<=g_highestRealPair))
			{
				if (isNonUniqueRobot(targ[0])&isRobot(name[0])&notRobot(name[1])&notRobot(targ[1])&nameMatch(name[1],targ[1])) // Can we replace "Robot" in ranking list with actual robot name
					replace = true;
				else if (isNonUniqueRobot(targ[1])&isRobot(name[1])&notRobot(name[0])&notRobot(targ[0])&nameMatch(name[0],targ[0])) // Can we replace "Robot" in ranking list with actual robot name
					replace = true;
				else if (notRobot(targ[1])&notRobot(name[0])) //	swap names in the ranking list if the robot in the wrong orientation
				{
					if (nameMatch(name[0],targ[1])&(!notRobot(name[1]))&(!notRobot(targ[0])))
						replace = true; 
				}
				else if (notRobot(targ[0])&notRobot(name[1])) // swap names in the ranking list if the robot in the wrong orientation
				{
					if (nameMatch(targ[0],name[1])&(!notRobot(name[0]))&(!notRobot(targ[1])))
						replace = true;
				}
			}
			
			if (replace)	// Replace the entry with the swapped version
			{
				pnames[k] = pname;
				return 1+j;
			}
			else
			{
				if (!isNonUniqueRobot(name[0]))
					if (nameMatch(name[0],targ[0])|nameMatch(name[0],targ[1])) found = true;
					
				if (!isNonUniqueRobot(name[1]))
					if (nameMatch(name[1],targ[0])|nameMatch(name[1],targ[1])) found = true;
				
				if (found)
				{
					pnames.push(name[0] + "+" + name[1]);
					
					if ((1+j)>g_highestRealPair)
						return "Sub" + (1+j);
					else
						return 1+j;
				}
			}
		}
	}
	
		// There was no partial match either, so not need to create a new real or pseudo pair number
	if (canAdd&!robotPair)	// For a robot pair it has already been done above
	{
		var names = new Array();
		names.push(name[0]+"+"+name[1]);
		g_pairNames.push(names);
		g_highestRealPair = g_pairNames.length;	
		return g_pairNames.length;
	}
	else	// Assign it artificial pair number, as substitute, don't increment g_highestRealPair
	{
		var names = new Array();
		names.push(name[0]+"+"+name[1]);
		g_pairNames.push(names);
		return "Sub" + g_pairNames.length;
	}
}

function post(path, str, ext) {
    method = "post";

    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
	form.setAttribute("target","_blank");

	var hiddenField = document.createElement("input");
	hiddenField.setAttribute("type", "hidden");
	hiddenField.setAttribute("name", "pbntext");
	hiddenField.setAttribute("value", str);
	form.appendChild(hiddenField);

    if (ext!=null)
    {
	var hiddenField2 = document.createElement("input");
	hiddenField2.setAttribute("type", "hidden");
	hiddenField2.setAttribute("name", "ext");
	hiddenField2.setAttribute("value", ext);
	form.appendChild(hiddenField2);	
    }

    document.body.appendChild(form);
    form.submit();
	document.body.removeChild(form);
}

function correctedDate(pdate)
{
	var ldate = pdate;
	
	try {
		var d = new Date(pdate);
		var t = d.getTime();
		t = t - 60000*(new Date()).getTimezoneOffset();
		d = new Date(t);
		var month = '' + (d.getMonth() + 1);
		var day = '' + d.getDate();
		var year = d.getFullYear();
	
		if (month.length < 2) 
			month = '0' + month;
		if (day.length < 2) 
			day = '0' + day;
	
		ldate = [year, month, day].join('-');
	} catch (err) {}
	
	return ldate;
}

function currentDate() {
    var d = new Date();
    var month = '' + (d.getMonth() + 1);
    var day = '' + d.getDate();
    var year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

function replaceSubstitute(subpair,newpair,name1,name2)
{
	g_pairNames[newpair-1].push(name1 + "+" + name2);
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var tline = g_tlines[i];
		
		if (tline.nspair==subpair) tline.nspair = newpair;
		if (tline.ewpair==subpair) tline.ewpair = newpair;
	}
}

function recheckSubs()
{
		// Attempt to rescan all traveller lines in case Subs can now be matched (can be missed first time around
		// depending whether pair in ranking list entry was set at the start of match or end of match								  
	for (var i=g_pairNames.length-1;i>=g_highestRealPair;i--)
	{
		g_pairNames.pop();
	}
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var tline = g_tlines[i];
		
		var nsnames = tline.north + "+" + tline.south;
		var ewnames = tline.east + "+" + tline.west;
		
		tline.nspair = getPairNumber(nsnames,false,false);
		tline.ewpair = getPairNumber(ewnames,false,false);
	}

		// Repeat, but traversing the tlines array backwards
	for (var i=g_pairNames.length-1;i>=g_highestRealPair;i--)
	{
		g_pairNames.pop();
	}
	
	for (var i=g_tlines.length-1;i>=0;i--)
	{
		var tline = g_tlines[i];
		
		var nsnames = tline.north + "+" + tline.south;
		var ewnames = tline.east + "+" + tline.west;
		
		tline.nspair = getPairNumber(nsnames,false,false);
		tline.ewpair = getPairNumber(ewnames,false,false);
	}
}

function scanTravellers()
{
		// Recheck Subs
	recheckSubs();
	
		// First build array of board numbers
	var bdnums = new Array();
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var bd = g_tlines[i].board;
		var found = false;
		
		for (j=0;j<bdnums.length;j++)
		{
			if (bdnums[j]==bd)
			{
				found = true;
				break;
			}
		}
		
		if (!found) bdnums.push(bd);
	}
	
		// Find maximumscores per board
	var maxScoresPerBoard = 0;
	var scoresPerBoard = new Array();
	
	for (var i=0;i<bdnums.length;i++)
	{
		scoresPerBoard[i] = 0;
	}
	
	for (var i=0;i<bdnums.length;i++)
	{
		var bd = bdnums[i];
		var count = 0;
		
		for (j=0;j<g_tlines.length;j++)
		{
			var tline = g_tlines[j];
			if ((bd==tline.board)&!isSitoutTable(tline)) count++;
		}
		
		if (count>maxScoresPerBoard) maxScoresPerBoard = count;
	}
	
	for (i=0;i<bdnums.length;i++)
	{
		var subtlines = new Array();
		var subtlinesNoSitout = new Array();
		
		var bd = bdnums[i];
		
		for (var j=0;j<g_tlines.length;j++)
		{
			var tline = g_tlines[j];
			
			if (tline.board==bd)
			{
				subtlines.push(tline);
				
				if (!isSitoutTable(tline)) // Not a sitout, so should be included in results calculation
					subtlinesNoSitout.push(tline);
			}
		}
		
		if (g_scoringType=="MATCH_POINTS")
			calcMatchPoints(subtlinesNoSitout,maxScoresPerBoard);
		else
			calcXimps(subtlinesNoSitout,maxScoresPerBoard);
			
		var nsRobotPairCount = 0;	// Count of NS Robot pairs on this traveller
		var ewRobotPairCount = 0;	// Count of EW Robot pairs on this traveller
		var totalRobotPairCount = 0;
		
		for (var j=0;j<subtlines.length;j++)
		{
			var tline = subtlines[j];
			var nsname1 = tline.north;
			var nsname2 = tline.south;
			var ewname1 = tline.east;
			var ewname2 = tline.west;
			
			if (isNonUniqueRobotPair(nsname1,nsname2)) nsRobotPairCount++;
			if (isNonUniqueRobotPair(ewname1,ewname2)) ewRobotPairCount++;
		}
		
		totalRobotPairCount = nsRobotPairCount + ewRobotPairCount;

		for (var j=0;j<subtlines.length;j++)
		{
			var tline = subtlines[j];
			var nsnames = tline.north + "+" + tline.south;
			
			if ((!isNonUniqueRobotPair(tline.north,tline.south))|((totalRobotPairCount==1)&g_winners==1)|((nsRobotPairCount==1)&g_winners==2))
				tline.nspair = getPairNumber(nsnames,false,false);
			else	// It's a robot pair, and there are multiple robot pairs in ranking list, so don't automatically assign
				tline.nspair = getPairNumber(nsnames,false,true);			
		}
		
		for (var j=0;j<subtlines.length;j++)
		{
			var tline = subtlines[j];
			var ewnames = tline.east + "+" + tline.west;
			
			if ((!isNonUniqueRobotPair(tline.east,tline.west))|((totalRobotPairCount==1)&g_winners==1)|((ewRobotPairCount==1)&g_winners==2))
				tline.ewpair = getPairNumber(ewnames,false,false);
			else	// It's a robot pair, and there are multiple robot pairs in ranking list, so don't automatically assign
				tline.ewpair = getPairNumber(ewnames,false,true);			
		}
		
		var subCount = 0;
		var nsSubCount = 0;
		var ewSubCount = 0;
		
		var pairUsed = new Array();
		
		for (var j=0;j<g_highestRealPair;j++)
		{
			pairUsed[j] = false;
		}
		
			// Are there any pair numbers prefixed with "Sub" on this traveller ?
		for (var j=0;j<subtlines.length;j++)
		{
			var tline = subtlines[j];
			
			if (tline.nspair.toString().startsWith("Sub"))
			{
				subCount++;
				nsSubCount++;
			}
			else if (tline.nspair!=0)	// Don't record 0 pair number for sitout pair
				pairUsed[tline.nspair-1] = true;
				
			if (tline.ewpair.toString().startsWith("Sub"))
			{
				subCount++;
				ewSubCount++;
			}
			else if (tline.ewpair!=0)	// Don't record 0 pair number for sitout pair
				pairUsed[tline.ewpair-1] = true;
		}
		
			// There's a possibility the pair number can still be allocated automatically
			// if there is just one missing pair number on the traveller and only one substitute pair number
			// (for two winner events this applies to NS and EW pairs separately).
		var idx = -1;
		var unusedCount = 0;
		var unusedNSCount = 0;
		var unusedEWCount = 0;
		var nsUnusedPair = 0;
		var ewUnusedPair = 0;
		var unusedPair = 0;
		
		if (g_swissTeams)	// assumes NS and EW pairs never switch direction
		{
			for (var j=0;j<g_highestRealPair;j++)
			{
				if (!pairUsed[j])
				{
					if (((j+1)%2)==0)	// It's an EW pair
					{
						ewUnusedPair = j+1;
						unusedEWCount++;
					}
					else	// It's a NS pair
					{
						nsUnusedPair = j+1;
						unusedNSCount++;
					}
				}
			}
		}
		else
		{
			for (var j=0;j<g_highestRealPair;j++)
			{
				if (!pairUsed[j])
				{
					if (g_winners==2)
					{
						if ((j+1)<=g_highestNSPairNumber)
						{
							nsUnusedPair = j+1;
							unusedNSCount++;
						}
						else
						{
							ewUnusedPair = j+1;
							unusedEWCount++;
						}
					}
					else
					{
						unusedPair = j+1;
					}
					
					unusedCount++;
				}
			}
		}
		
			// See if we can replace remaining "Sub" pair numbers (only possible if there is only a single missing pair
			// number for the given direction, or 1 overall for a single winner movement)
		for (var j=0;j<subtlines.length;j++)
		{
			var tline = subtlines[j];
			
			if (tline.nspair.toString().startsWith("Sub"))
			{
				if (((g_winners==2)|g_swissTeams)&(unusedNSCount==1)&(nsSubCount==1))
					replaceSubstitute(tline.nspair,nsUnusedPair,tline.north,tline.south);
				else if ((g_winners==1)&(unusedCount==1))
					replaceSubstitute(tline.nspair,unusedPair,tline.north,tline.south);
			}

			if (tline.ewpair.toString().startsWith("Sub"))
			{
				if (((g_winners==2)|g_swissTeams)&(unusedEWCount==1)&(ewSubCount==1))
					replaceSubstitute(tline.ewpair,ewUnusedPair,tline.east,tline.west);
				else if ((g_winners==1)&(unusedCount==1))
					replaceSubstitute(tline.ewpair,unusedPair,tline.east,tline.west);
			}
		}
	}
	
	var str = "";
	
	g_tlines.sort(function(a,b){
						if (Number(a.board)>Number(b.board)) return 1;
						else if (Number(a.board)<Number(b.board)) return -1;
						else {
							if (a.nspair>b.nspair) return 1;
							else if (a.nspair<b.nspair) return -1;
							else return 0;
						}
				});
}

function formatTravellerLines()
{
	var str = "";
	g_csv += "#TravellerLines\n";
	var colstr = "nsMpts,ewMpts";
	
	if (g_scoringType=="CROSS_IMPS")
		colstr = "nsXimps,ewXimps";
		
	g_csv += "#Board,North,South,East,West,Result,Contract,Declarer,Tricks,Lead,Score,Percent," + colstr + ",calcPercent,nsPair,ewPair,section,playdata,tdate" + "\n";
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var t = g_tlines[i];
		
		if (isSitoutTable(t)) continue;	// Don't include traveller lines for sitout tables in spreadsheet
		
			// Deal with Averages in Contract and Score Field
		var numscore = t.numscore;
		var contract = t.contract;
		
		if (contract.charAt(0)=="A")
		{
			numscore = "A";
			if (contract.charAt(1)=="+") numscore += "60";
			else if (contract.charAt(1)=="=") numscore += "50";
			else numscore += "40";
			
			if (contract.charAt(2)=="+") numscore += "60";
			else if (contract.charAt(2)=="=") numscore += "50";
			else numscore += "40";
			
			contract = "";
		}
		
		str += t.board + "," + lookupAlias(t.north) + "," + lookupAlias(t.south) + "," + lookupAlias(t.east) + "," + lookupAlias(t.west) + ",";
		str += t.result + "," + contract + "," + t.declarer + "," + t.tricks + "," + t.lead + "," + numscore + "," + t.score + ",";
		str += t.mpNS + "," + t.mpEW + "," + t.percent + "," + t.nspair + "," + t.ewpair + "," + t.section + "," + "\"" + t.lin.replace(/;/g,",") +"\"" + "," +  t.tdate + "\n";
	}
	
	g_csv += str;
}

function assignPlaces(rlines)
{
	var current = 0;
	var prevscore = "";
	var inc = 1;
	
	if (g_swissTeams) inc = 2;
	
	for (var i=0;i<rlines.length;i++)
	{
		var rl = rlines[i];
		
		if ((g_swissTeams)&((i%2)!=0))
		{
			rl.rank = "";
			continue;
		}
		
		if (rl.score==prevscore)
		{
			rl.rank = current;
			rlines[i-inc].rank = rl.rank;
		}
		else
		{
			if (!g_swissTeams)
				rl.rank = 1+i;
			else
				rl.rank = 1+i/2;
				
			current = rl.rank;
		}
		
		prevscore = rl.score;
	}
}

function mergeRankSections(dir)
{
	var rsections = g_rankingData.rank;
	
	var section = new Object();
	section.ranking = new Array();
	section.section = 1;
	section.direction = dir;
	
		// Find the header for the first section for this direction
	section.header = "";
	
	for (var i=0;i<rsections.length;i++)
	{
		if (rsections[i].direction==dir)
		{
			section.header = rsections[i].header;
			break;
		}
	}
	
	for (var i=0;i<rsections.length;i++)
	{
		var rsect = rsections[i];
		
		if (rsect.direction==dir)
		{
			var rlines = rsect.ranking;
			
			for (var j=0;j<rlines.length;j++)
			{
				section.ranking.push(rlines[j]);
			}
		}
	}

	section.ranking.sort(function(a,b){
						if (Number(a.score)>Number(b.score)) return -1;
						else if (Number(a.score)<Number(b.score)) return 1;
						else return 0;
				});
	
	assignPlaces(section.ranking);
	
	return section;
}

function assignRankingPairNumbers(rlines)
{
	for (var j=0;j<rlines.length;j++)
	{
		var rline = rlines[j];

			// Check that names are in same position as in tlines - BBO often shows them switched if one is a robot
		var names = rlines[j].name.split("+");
		
		if ((names[0].toUpperCase()=="ROBOT")&(names[1].toUpperCase()!=="ROBOT"))
		{
			for (var k=0;k<g_tlines.length;k++)
			{
				var tline = g_tlines[k];
				
				if ((names[1].toUpperCase()==tline.north.toUpperCase())|(names[1].toUpperCase()==tline.east.toUpperCase()))
				{
					rlines[j].name = names[1] + "+" + names[0];
					break;
				}
			}
		}
		else if ((names[1].toUpperCase()=="ROBOT")&(names[0].toUpperCase()!=="ROBOT"))
		{
			for (var k=0;k<g_tlines.length;k++)
			{
				var tline = g_tlines[k];
				
				if ((names[0].toUpperCase()==tline.south.toUpperCase())|(names[0].toUpperCase()==tline.west.toUpperCase()))
				{
					rlines[j].name = names[1] + "+" + names[0];
					break;
				}
			}
		}
		else ((names[0].toUpperCase()!=="ROBOT")&(names[1].toUpperCase()!=="ROBOT")) // Non-robot pairs also frequently appear switched on the ranking list in Swiss Teams events !
		{
			for (var k=0;k<g_tlines.length;k++)
			{
				var tline = g_tlines[k];
				
				if ((names[0].toUpperCase()==tline.south.toUpperCase())|(names[0].toUpperCase()==tline.west.toUpperCase())|
					(names[1].toUpperCase()==tline.north.toUpperCase())|(names[1].toUpperCase()==tline.east.toUpperCase()))
				{
					rlines[j].name = names[1] + "+" + names[0];
					break;
				}
			}
			
		}

		rline.pair = getPairNumber(rline.name,true,false);	
	}
}

function boardsPlayedByNamedPair(names)
{
	names = names.split("+");
	var count = 0;
	
	for (var i=0;i<g_tlines.length;i++)
	{
		var tline = g_tlines[i];
		
		if ((tline.north.toUpperCase()==names[0].toUpperCase())&(tline.south.toUpperCase()==names[1].toUpperCase())|(tline.east.toUpperCase()==names[0].toUpperCase())&(tline.west.toUpperCase()==names[1].toUpperCase()))
			count++;
	}
	
	return count;
}

function formatPairNames()
{
	var found = false;
	
	for (var i=0;i<g_pairNames.length;i++)	// Are there any substitutions in this event ?
	{
		if (g_pairNames[i].length>1)
		{
			found = true;
			break;
		}
	}
	
	if (found)
	{
			// Now check if there are still unresolved substitutions
		var subCount = 0;
		
		for (var i=0;i<g_tlines.length;i++)
		{
			var tline = g_tlines[i];
			
			if (((tline.nspair + " ").indexOf("Sub")!=-1)|((tline.ewpair + " ").indexOf("Sub")!=-1))
				subCount++;
		}
		
		if (subCount==0)	// All substitutions were finally resolved, so remove unresolved subs from pairNames
		{
			for (var i=g_pairNames.length-1;i>=g_highestRealPair;i--)
			{
				g_pairNames.pop();
			}
		}
		
		g_csv += "\n";
		g_csv += "#Substitutions\n";
		g_csv += "#Pair,Name1,Name2,Played\n";
		
		for (var i=0;i<g_pairNames.length;i++)
		{
			var names = g_pairNames[i];
			
			if (names.length>1)
			{
				var pair = i+1;
				
				if ((i+1)>g_highestRealPair)
					pair = "Sub" + pair;
					
				for (var j=0;j<names.length;j++)
				{
					if (j==0)
						g_csv += pair + ",";
					else
						g_csv += ",";
						
					var lnames = names[j].split("+");
						
					g_csv += lookupAlias(lnames[0]) + "," + lookupAlias(lnames[1]) + ",";
					
					g_csv += boardsPlayedByNamedPair(names[j]);
					g_csv += "\n";
				}
			}
		}
	}
}

function processResults()
{
	var rsections = g_rankingData.rank;
	
		// assign pair numbers for NS Pairs or Single Winner Pairs in ranking lists
	for (var i=0;i<rsections.length;i++)
	{
		var rlines = rsections[i].ranking;	
		
		var dir = rsections[i].direction;
		
		if ((dir=="NS")|(dir=="Both"))
		{
			assignRankingPairNumbers(rlines);
			g_highestNSPairNumber += rlines.length;
		}
			
		if (dir=="EW")
			g_winners = 2;
	}
	
		// assign pair numbers for EW Pairsranking lists
	for (var i=0;i<rsections.length;i++)
	{
		var rlines = rsections[i].ranking;	
		
		var dir = rsections[i].direction;
		
		if (dir=="EW")
			assignRankingPairNumbers(rlines);
	}	
	
	var BothSection = mergeRankSections("Both");
	var NSSection = mergeRankSections("NS");
	var EWSection = mergeRankSections("EW");
	
	g_rankingData.rank = new Array();
	
	if (BothSection.ranking.length!=0)
		g_rankingData.rank.push(BothSection);
	
	if (NSSection.ranking.length!=0)
		g_rankingData.rank.push(NSSection);
	
	if (EWSection.ranking.length!=0)
		g_rankingData.rank.push(EWSection);
		
	rsections = g_rankingData.rank;	// get newly merged sections
	
		// calculate matchpoints since they are not supplied
	scanTravellers();
	
	var bdnums = new Array();
	
	for (var i=0;i<g_tlines.length;i++)
		bdnums[g_tlines[i].board]=1;
		
	var nboards = Object.keys(bdnums).length;
	
	g_csv += "#BoardCount," + nboards + "\n";
	
	if (g_swissTeams)
		g_csv += "#Tournament,\"" + g_tournament + "\"," + "\"https://webutil.bridgebase.com/v2/tview.php?t=" + g_tournament + "\"\n";
	else	// For backward compatbility with BBOtoXML v1.2.8 and earlier
		g_csv += "#Tournament," + g_tournament + "," + "https://webutil.bridgebase.com/v2/tview.php?t=" + g_tournament + "\n";

	g_csv += "#Date," + g_date + ",Date:" + g_date + "\n";
	
	if (g_swissTeams)
		g_csv += "#EventType,SWISS_TEAMS\n";
		
	g_csv += "#ScoringType," + g_scoringType + "\n";
	
	if (g_swissTeams)
	{
		g_csv += "#MatchScoringType,VP\n";
	}
	
	for (var i=0;i<rsections.length;i++)
	{
		var rheader = rsections[i].header;
		var rlines = rsections[i].ranking;
		
		g_csv += rheader;
		
		for (var j=0;j<rlines.length;j++)
		{
			var rline = rlines[j];
//			rline.pair = getPairNumber(rline.name,true,false);
			
			var namepair = rline.name.split("+");
			var name1 = lookupAlias(namepair[0]);
			var name2 = lookupAlias(namepair[1]);
			var idNE = lookupID(namepair[0]);
			var idSW = lookupID(namepair[1]);
		
			g_csv += rline.rank + "," + name1 + "+" + name2 + "," + rline.score + "," + rline.pair + "," + idNE + "," + idSW + "," + rline.pts + "," + rline.section + "," + rline.stratum + "\n";
		}
	}
	
	formatTravellerLines();
	
	formatPairNames();
}

function isScoreMissing(tlines,idx)
{
	var result = false;
	var numscore = tlines[idx].numscore;

	if (isNaN(numscore))
		result = true;
		
	return result;
}

function isAveMissScores(tlines,idx,counts)
{
	var outcome = true;

	var average = (tlines[idx].result.charAt(0)=="A");
	
	if (average)
		counts.aveCount++;
	else if (isScoreMissing(tlines,idx))
		counts.missCount++;
	else
		outcome = false;

	return outcome;		
}

function getNS(ave,maxScores)
{
	var sres = 0.0;
	var strTemp = 50;	// Assume 50%
	
	if (ave.charAt(1)=="+")
		strTemp = 60;
	else if (ave.charAt(1)=="-")
		strTemp = 40;
		
	sres = ((maxScores*2 - 2) * Number(strTemp))/100.0;
	if (sres<0.0) sres=0.0;
	
	return sres;
}

function getEW(ave,maxScores)
{
	var sres = 0.0;
	var strTemp = 50;	// Assume 50%
	
	if (ave.charAt(2)=="+")
		strTemp = 60;
	else if (ave.charAt(2)=="-")
		strTemp = 40;
		
	sres = ((maxScores*2 - 2) * Number(strTemp))/100.0;
	if (sres<0.0) sres=0.0;
	
	return sres;
}

function isAverage(tlines,idx)
{
	return (tlines[idx].result.charAt(0)=="A");
}

function getEWXimpsAve(tlines,idx)
{
	var tline = tlines[idx];
	var ave = tline.result;
	
	if (ave.charAt(2)=="=")
		return 0.0;
	else if (ave.charAt(2)=="+")
		return 2;
	else
		return -2;
}

function calcXimps(tlines,maxScoresPerBoard)
{
	for (var i=0;i<tlines.length;i++)
	{
		tlines[i].mpNS = tlines[i].score;
		tlines[i].percent = "";
		
		if (!isAverage(tlines,i))
		{
			if (!isNaN(tlines[i].mpNS))
				tlines[i].mpEW = -Number(tlines[i].mpNS);
			else
			{
				tlines[i].mpNS = 0.0;
				tlines[i].mpEW = 0.0;
			}
		}
		else
		{
			tlines[i].mpNS = tlines[i].score; // NS score is already in score field, just copy it to mpNS
			tlines[i].mpEW = getEWXimpsAve(tlines,i);
		}
	}
}

function calcMatchPoints(tlines,maxScoresPerBoard)
{
	var counts = new Object();
	counts.aveCount = 0;
	counts.missCount = 0;
	
	var i=0;
	var score,score2;
	
	for (i=0;i<tlines.length;i++)
	{
			// Calc match points for normal scores
		var mpNS = 0;
		var mpEW = 0;
		
   		if (!isAveMissScores(tlines,i,counts))
		{
			score = Number(tlines[i].numscore);
			
			for (var j=0;j<tlines.length;j++)
			{
				if ((!isAverage(tlines,j))&(!isScoreMissing(tlines,j)))
				{
					score2 = Number(tlines[j].numscore);
					
					if (i!=j)
					{
						if (score==score2) mpNS++;
						if (score>score2) mpNS = mpNS + 2;
					}
				}
			}
		}
		
		tlines[i].mpNS = mpNS;
	}

		// Calc match points for averages
	var top = 2*(tlines.length - counts.aveCount - counts.missCount) - 2;

	for (var i=0;i<tlines.length;i++)
	{
		if (!isScoreMissing(tlines,i))
		{
			if (!isAverage(tlines,i))
			{
				tlines[i].mpEW = top - tlines[i].mpNS;
			}
		}
	}

		//Apply Neuberg
	var actualScores = tlines.length - counts.aveCount - counts.missCount;
	
		// N.B Disable Neuberg, BBO doesn't seem to apply it !
	for (i=0;i<tlines.length;i++)
	{
		if (isAverage(tlines,i))
		{
			tlines[i].mpNS = getNS(tlines[i].result, maxScoresPerBoard);
			tlines[i].mpEW = getEW(tlines[i].result, maxScoresPerBoard);
		}
/*		else if (!isScoreMissing(tlines,i))
		{
				// there now follows the Neuberg formula
			tlines[i].mpNS = ((maxScoresPerBoard / actualScores) * (tlines[i].mpNS + 1)) - 1;
			tlines[i].mpEW = ((maxScoresPerBoard / actualScores) * (tlines[i].mpEW + 1)) - 1;
		}*/
	}
	
	for (i=0;i<tlines.length;i++)
	{
		var tline = tlines[i];
		var percent = ((100*tline.mpNS)/(tline.mpNS+tline.mpEW)).toFixed(2);
		tlines[i].percent = percent;
	}
	
	return counts.missCount;
}

function storeBoard(lin)
{
		// Will generate exception if tline.lin doesn't contain data (can happen if scorecard/traveller does not include explicit parameter for lin data)
	try {	// Store the board definitions for later makeable contract calculation and PBN generation
		var thisboard = JSON.parse(linToJson(decodeURIComponent(lin)));
	
		if ((typeof g_boardsRead[thisboard.boards[0].board])=="undefined")
		{
			g_boardsRead[thisboard.boards[0].board] = 1;
			g_hands.boards.push(thisboard.boards[0]);
		}
	} catch (e) {};
}

function convertLinNames(tline)
{
	var prefix = "";
	var postfix = "";
	var lin = tline.lin;
	
	var idx = lin.indexOf("pn|");
	
	if (idx!=-1)
	{
		prefix = lin.substring(0,idx+3);
		
		var str = lin.substring(idx+3);
		idx = str.indexOf("|");
		
		if (idx!=-1)
		{
			postfix = str.substring(idx);
			
			var names = str.substring(0,idx);
			
			names = names.replace(/%2C/g,",");

			names = names.split(";");
			var namestr = "";
			
			for (var i=0;i<names.length;i++)
			{
				if (names[i].length!=0)
				{
					if (i!=0) namestr += ";";
					
					namestr += lookupAlias(names[i].replace(/%20/g," "));
				}
			}
			
			tline.lin = prefix + namestr.replace(/ /g,"%20").replace(/\'/g,"\\'") + postfix;
		}
	}
	
}

function storetlines(data)
{
	var trows = data.split("\n");
	
	for (var i=0;i<trows.length-1;i++)	// Last row will be a blank row, so don't include it
	{
		var tline = new Object();
		var trow = trows[i].split(",");
		
		tline.board = trow[0];
		
		if (tline.board=="") // Couldn't get board number from lin data, probably lin data is not available, so work it out if possible
		{
			if (!g_travellerMode)	// boards are not necessarily in board number order on scorecard (some can be some missing, e.g. played by a substitute)
			{
					// Start again using travellers, instead of scorecards
				g_travellerMode = true;
				g_index = 0;
				g_activeLinks = g_travLinks;
				g_tlines = new Array();
				return;
			}
			else
				tline.board = g_index + 1;
		}
		
		tline.north = trow[1];
		tline.south = trow[2];
		tline.east = trow[3];
		tline.west = trow[4];
		tline.result = trow[5];
		tline.contract = trow[6];
		tline.declarer = trow[7];
		tline.tricks = trow[8];
		tline.lead = trow[9];
		tline.numscore = trow[10];
		tline.score = trow[11];
		tline.lin = trow[12];
		tline.tdate = trow[13];
		tline.section = "";	// The value is now left blank ! (the BBO travellers do not contain a section field)
		
		storeBoard(tline.lin);
		convertLinNames(tline);
		
		var found = false;
		
		for (var j=0;j<g_tlines.length;j++)
		{
			var gtline = g_tlines[j];
			
			if ((tline.board==gtline.board)&(tline.north==gtline.north)&(tline.south==gtline.south)&(tline.east==gtline.east)&(tline.west==gtline.west))
			{
				found = true;
				break;
			}
		}
		
		if (!found) g_tlines.push(tline);
	}
}

	// Functions to convert a lin string to internal form
function convertHand(cards,hand)
{
	var str = "";
	var suits = "SHDC";
	var values = "23456789TJQKA";
	var suitIndex = 0;
	var currentHand = new Array();
	var i,j;
	
	for (i=0;i<4;i++)
	{
		currentHand[i] = new Array();
		
		for (j=0;j<13;j++)
			currentHand[i][j] = 0;
	}
	
	for (i=0;i<hand.length;i++)
	{
		var cchar = hand.charAt(i);
		
		if ((cchar=='S')|(cchar=='H')|(cchar=='D')|(cchar=='C'))
		{
			suitIndex = suits.indexOf(cchar);
			if (cchar!='S') str = str + ".";
		}
		else
		{
			currentHand[suitIndex][values.indexOf(cchar)] = 1;
			cards[suitIndex][values.indexOf(cchar)] = 1;
		}
	}
	
	str = "";
	
	for (i=0;i<4;i++)
	{
		for (j=12;j>=0;j--)
		{
			if (currentHand[i][j]!=0)
				str = str + values.charAt(j);
		}
		
		if (i!=3)
			str = str + ".";
	}
	
	return str;
}

function inferHand(cards)
{
	var suits = "SHDC";
	var values = "23456789TJQKA";
	var suitIndex = 0;
	var hand = "";
	var i,j;
	
	for (i=0;i<4;i++)
	{
		hand = hand + suits.charAt(i);
		
		for (j=0;j<13;j++)
		{
			if (cards[i][j]==0)
			{
				hand = hand + values.charAt(j);
			}
		}
	}
	
	return convertHand(cards,hand);
}

function writeLinHand(boardStr,dealer,vul,north,south,east,west,bids,played,claimed,pnames,score)
{
	var outStr = "";
	var direction = "NESW";
	var i;
	
	outStr = outStr + "{\"board\":\"" + boardStr + "\",";
	
	if (pnames.length>0)
	{
		outStr += "\"PlayerNames\":[";
		
		for (i=0;i<pnames.length;i++)
		{
			if (i!=0) outStr += ",";
			var pname = pnames[i].trim();
			if (pname.indexOf("~~")==0) pname = "Robot";
			outStr += "\"" + pname + "\"";
		}
		
		outStr += "],";
	}
	
	outStr = outStr + "\"Dealer\":\"" + dealer + "\",";
	outStr = outStr + "\"Vulnerable\":\"" + vul + "\",";		
	
	outStr = outStr + "\"Deal\":[";
	
	outStr = outStr + "\"" + north + "\"," + "\"" + east + "\"," + "\"" + south + "\"," + "\"" + west + "\"";
	
	outStr = outStr + "],";
	
	outStr = outStr + "\"Bids\":[";
	
	for (i=0;i<bids.length;i++)
	{
		outStr = outStr + "\"" + bids[i] + "\"";
		if (i<bids.length-1) outStr = outStr + ",";
	}
	
	outStr = outStr + "],";
	
	outStr = outStr + "\"Played\":[";
	
	for (i=0;i<played.length;i++)
	{
		outStr = outStr + "\"" + played[i] + "\"";
		if (i<played.length-1) outStr = outStr + ",";
	}
	
	outStr = outStr + "],";
	
	outStr = outStr + "\"Claimed\":\"" + claimed + "\",";
	outStr = outStr + "\"Score\":\"" + score + "\",";
	
	var contract = "";
	var doubled = false;
	var redoubled = false;
	
	var relPosition = 0;
	
	for (i=bids.length-1;i>=0;i--)
	{
		var bd = bids[i];
		
		bd = bd.toUpperCase();
		
		if ((!doubled)&(!redoubled))
		{
			if (bd=="D") doubled = true;
			if (bd=="R") redoubled = true;
		}
		
		if ((!(bd=="P"))&(!(bd=="R"))&(!(bd=="D")))
		{
			contract = bd;
			
			if (doubled) contract = contract + "x";
			if (redoubled) contract = contract + "xx";
			
			relPosition = i;
			break;
		}
	}
	
	if (!(contract==""))
	{
		var suitChar = contract.toUpperCase().charAt(1);
				
			// Identify who was first to bid this suit
		for (i=relPosition;i>=0;i=i-2)	// Step down by 2 because only looking at own bids and partner's bids
		{
			var bd = bids[i].toUpperCase();
			
			if (bd.length>1)
				if (suitChar==bd.charAt(1))
					relPosition = i;
		}
	}
	else
	{
		contract = "Passed";
	}
	
	var position = direction.indexOf(dealer) + relPosition;
	var declarer = "" + direction.charAt(position % 4);
	
	outStr = outStr + "\"Contract\":\"" + contract + "\",";
	outStr = outStr + "\"Declarer\":\"" + declarer + "\",";
	
	var doubleDummyTricks = "********************";	
	outStr = outStr + "\"DoubleDummyTricks\":\"" + doubleDummyTricks + "\"}";
	
	return outStr;		
}

function linToJson(str)
{
		// Make sure there is a defined "trim" function (needed for IE8 and earlier)
	if(typeof String.prototype.trim !== 'function') {
	  String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, ''); 
	  }
	}

	var dealerSelect = ["S","W","N","E"];
	var bids = new Array();
	var played = new Array();
	var playerNames = new Array();
	var boardDealt = false;
	var outStr = "";
	var i,j;
	var inHeader = true;
	
//		try {
		outStr += "{\"boards\":[";
					
		str = str.replace(/\n/g,"");
		str = str.replace(/\r/g,"");
		
		var pairs = str.split("|");
		
		var boardStr = "";
		var board=-1;
		var vul="";
		var dealer="";
		var deal="";
		var north = "";
		var south = "";
		var west = "";
		var east = "";
		var claimed = "";
		var score = "";
		var pnames = new Array();
		var count = 0;
		
		for (i=0;i<pairs.length/2;i++)
		{
			var index = 2*i;
			
			var command = pairs[index];
			var para = pairs[index+1];
			
			if (command=="st")	// Marks start of new board ?
			{
				inHeader = false;
				
				if (boardDealt)
				{
					if (count!=0) outStr = outStr + ",";
					count++;
					
					outStr += writeLinHand(boardStr,dealer,vul,north,south,east,west,bids,played,claimed,pnames,score);
				
					bids = new Array();
					played = new Array();
					vul="";
					dealer="";
					deal="";
					boardDealt = false;	
					claimed = "";
					score = "";
				}
			}
			else if (command=="qx")
			{
				inHeader = false;
				
				if (boardDealt)
				{
					if (count!=0) outStr += ",";

					count++;
					
					outStr += writeLinHand(boardStr,dealer,vul,north,south,east,west,bids,played,claimed,pnames,score);
					bids = new Array();
					played = new Array();
					vul="";
					dealer="";
					deal="";
					boardDealt = false;		
					claimed = "";
					score = "";
				}
				
//						board = Integer.valueOf(boardStr);
				boardStr = para;
				
				if (boardStr.charAt(0)=='o')
					boardStr = boardStr.substring(1) + ".Open";
				else if (boardStr.charAt(0)=='c')
					boardStr = boardStr.substring(1) + ".Closed";					
			}
			else if (command=="mb")
			{
				inHeader = false;
				bids[bids.length] = para;
			}
			else if (command=="pc")
			{
				inHeader = false;
				played[played.length] = para;
			}
			else if (command=="ah")	// An alternative command for expressing the board number
			{
				var fields = para.split(" ");
				inHeader = false;
				para = fields[1].trim();
				
				boardStr = para;
			}
			else if (command=="md")
			{
				inHeader = false;
				var dnum = Number(para.substring(0,1));
				
				if (!(para.substring(1,2)==","))
				{
					boardDealt = true;
					dealer = dealerSelect[dnum-1];
					deal = para.substring(1);
					
					var hands  = deal.split(",");
					var cards = new Array();
					
					for (j=0;j<4;j++)
					{
						cards[j] = new Array();
						
						for (k=0;k<13;k++)
							cards[j][k]=0;
					}
					
					south = convertHand(cards,hands[0]);
					west = convertHand(cards,hands[1]);
					north = convertHand(cards,hands[2]);
					
					if (hands.length>3)
					{
						if (hands[3].trim().length!=0)
							east = convertHand(cards,hands[3]);
						else
							east = inferHand(cards);
					}
					else
					{
						east = inferHand(cards);
					}
				}
			}
			else if (command=="pn")
			{
				if (inHeader)
					playerNames = para.split(",");
				
				pnames = para.split(",");
			}
			else if (command=="sv")
			{
				inHeader = false;
				if (para=="o") vul = "None";
				else if (para=="n") vul = "NS";
				else if (para=="e") vul = "EW";
				else if (para=="b") vul = "All";
			}
			else if (command=="mc")
			{
				inHeader = false;
				claimed = para;
			}
			else if (command=="zz")
			{
				score = para;
			}
		}
		
		if (boardDealt)
		{
			if (count!=0) outStr += ",";
			count++;
			
			outStr += writeLinHand(boardStr,dealer,vul,north,south,east,west,bids,played,claimed,pnames,score);
		}
		
		outStr += "]";
		
		if (playerNames.length>0)
		{
			outStr += ",\"PlayerNames\":[";
			
			for (i=0;i<playerNames.length;i++)
			{
				if (i!=0) outStr += ",";
				var pname = playerNames[i].trim();
				if (pname.indexOf("~~")==0) pname = "Robot";
				outStr += "\"" + pname + "\"";
			}
			
			outStr += "]";
		}
		
		outStr += "}";
//		} catch (e) {alert("lin file conversion error");};
	
	return outStr;
}


