// ==UserScript==
// @name        DS_Raussteller
// @namespace   de.die-staemme
// @version     0.2
// @description Stellt Truppen in angegriffenen Dörfern automatisch raus, und bricht die Angriffe ab.
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       unsafeWindow
// @match       https://*.die-staemme.de/game.php?
// @include     https://*.die-staemme.de/game.php?*screen=overview_villages*mode=incomings*
// @include     https://*.die-staemme.de/game.php?*mode=imcommings*screen=overview_villages
// @include     https://*.die-staemme.de/game.php?*screen=place*
// @include     https://*.die-staemme.de/game.php?*screen=place*try=confirm*
// @include     https://*.die-staemme.de/game.php?*screen=info_command*
// @include     https://*.die-staemme.de/game.php?*
// @exclude     https://*.die-staemme.de/game.php?*subtype=supports*
// @copyright   2016+, the stabel, git
// @downloadURL -
// ==/UserScript==

/*
 * V 0.1: Beginn der Implementierung
 * V 0.2: Unabhängigkeit von site reload. Timungen per
 */

var _version = "0.1";
var _Anleitungslink = "http://blog.ds-kalation.de/?p=68";

var _config = {"running":"false","abbruchzeit":6,"umbennenung":"---","units":"no_archer","rereadtime":20,"criticaltime":30,"frontbuffer":2,"backbuffer":2};
var _units = {
    "normal":["spear","sword","axe","archer","spy","light","marcher","heavy","ram","catapult","knight","snob"],
    "no_archer":["spear","sword","axe","spy","light","heavy","ram","catapult","knight","snob"],
    "no_knight":["spear","sword","axe","archer","spy","light","marcher","heavy","ram","catapult","snob"],
    "no_archer_knight":["spear","sword","axe","spy","light","heavy","ram","catapult","snob"]
};
$(function(){

    var storage = localStorage;
    var storagePrefix="raussteller_";
    //Speicherfunktionen
    function storageGet(key,defaultValue) {
        var value= storage.getItem(storagePrefix+key);
        return (value === undefined || value === null) ? defaultValue : value;
    }
    function storageSet(key,val) {
        storage.setItem(storagePrefix+key,val);
    }
    storageSet("auto_run",storageGet("auto_run","false"));
    var s = {"0":{"x":598,"y":387}};
    storageSet("target_list",storageGet("target_list",JSON.stringify(s)));
    storageSet("config",storageGet("config",JSON.stringify(_config)));
    s = {"0":0};
    storageSet("timestamp",storageGet("timestamp",JSON.stringify(s)));
    storageSet("incs",storageGet("incs",JSON.stringify(s)));
    storageSet("planned_atts",storageGet("planned_atts",JSON.stringify(s)));


    var autoRun = JSON.parse(storageGet("config")).running==="true";
    init_UI();
    if(autoRun){
        if(getPageAttribute("screen")=="overview_villages"&&getPageAttribute("mode")=="incomings"){
            onOverview();
        }else if (getPageAttribute("screen")=="place"&&getPageAttribute("raus")=="1") {
            onPlaceSend();
        }else if (getPageAttribute("screen")=="place"&&getPageAttribute("try")=="confirm"){
            onConfirm();
        }else if (getPageAttribute("screen")=="info_command"&&getPageAttribute("raus")=="1"){
            onInfoCommand();
        }else if (getPageAttribute("screen")=="place"){
            onPlaceCancel();
        }
    }
    function onOverview(){
        var table   = $("#incomings_table");
        var rows 	= $("tr",table).slice(1);
		    var row;
        var current = -1;

        /*(function tick(){
            if(!autoRun) {
                console.log("'Raussteller' not running..")
                return;
            }
            current ++;
            row=rows[current];
            if(getTimeLeft(row)<=360){ //6 minuten
                if(getAttackType(row)=="support"){
                    tick(); //überspringen
                }
                var id = getVillageID(row);
                var koords = getVillageKoords(row);
                console.log("id: "+id+", koords: "+JSON.stringify(koords));
                var timestamp = JSON.parse(storageGet("timestamp"));
                var config = JSON.parse(storageGet("config"));
                timestamp[id]=Date.now()+1000*60*config.abbruchzeit;
                storageSet("timestamp",JSON.stringify(timestamp));
                koords = nearestTarget(koords);

                var link = "/game.php?village="+id+"&screen=place&x="+koords.x+"&y="+koords.y+"&raus=1";
				        window.open(link, '_blank');
                tick(); //next line
            }else{
                console.log("no incoms in next few minutes");
                return;
            }
            //TODO nächste zeile, bei abbruchbedingung / spezielle umbennenung des eingehenden Angriffs


        })();*/
        if($("th",table).eq(0).text().indexOf("zuletzt aktualisiert")==-1){
            $("th",table).eq(0).text($("th",table).eq(0).text()+" zuletzt aktualisiert: "+$("#serverTime").text());
        }
        if(JSON.parse(storageGet("config")).running==="true"){
			      setTimeout(function(){
				          location.href	= "/game.php?screen=overview_villages&mode=incomings&subtype=attacks";
			      },percentage_randomInterval((parseInt(JSON.parse(storageGet("config")).abbruchzeit)*60000)*0.9,5));
		    }
    }
    function onPlaceSend(){
        console.log("trying to evacuate all units..");
        var form = $("#command-data-form");
        var units = _units[JSON.parse(storageGet("config")).units]; //shorter...
        for(var i in units){
            $("#unit_input_"+units[i]).attr("value",$("#unit_input_"+units[i]).attr("data-all-count"));
        }
        console.log("click");
        setTimeout(function(){
            $("#target_attack").click();
        },randomInterval(400,600));
    }
    function onPlaceCancel(){
        console.log("find outgoing attacks to cancel");
        var div = $("#commands_outgoings");
        if(div.length>0){
            var rows = $("tr.command-row",div).slice(0);
            var row;
            for(var i=0;i<rows.length;i++){
                row=rows[i];
                var cell = $("td",row).first();
                var attack_text = $("a span",cell).text();
                if(attack_text.indexOf("Raus_TS:")!=-1){
                    location.href= $("a",cell).attr("href")+"&raus=1";
                    console.log("going to");
                }
                if(attack_text.indexOf("Raus_Canceled_")!=-1 && (Date.now()-parseInt(attack_text.substring(attack_text.indexOf("Raus_Canceled_")+14,attack_text.length)))<10000){
                    window.close();
                }
            }
        }
    }
    function onConfirm(){

        var timestamp = JSON.parse(storageGet("timestamp"))[getPageAttribute("village")];
        if(timestamp<Date.now()||timestamp==undefined){//abbruch
            return;
        }
        var attackname  = "Raus_TS:"+timestamp;
        var form  = $("#command-data-form");
        $("th a",form).first().click();
        $(".rename-icon").click();
        $('[type="text"]',form).val(attackname);
		    $("#attack_name_btn",form).click();
        console.log("timestamp: "+timestamp+", aktuell: "+Date.now()+", div: "+Math.round((timestamp-Date.now())/60000)+"min.");
        setTimeout(function(){
            $("#troop_confirm_go").click();
            console.log("confirm");
        },randomInterval(400,500));
    }
    function onInfoCommand(){
        var table = $("#content_value");
        var cancel_link;
        $("a",table).each(function(){
            if($(this).text().indexOf("abbrechen")!=-1){
                cancel_link = $(this).attr("href")+"&raus=2"; //raus=2 hinweiß zum fenster schließen
            }
        });
        if(cancel_link!=undefined){ //falls abbrechen noch möglich
            var cancel_time = parseInt($("#command_comment").text().substring($("#command_comment").text().indexOf("TS:")+3,$("#command_comment").text().length));
            if(cancel_time-Date.now()>0){ //läuft noch ab
                console.log("Canceling this attack in "+Math.round((cancel_time-Date.now())/60000)+" min.");
                $("th a",$("#content_value")).first().click();
                $(".rename-icon").click();
                $('[type="text"]',$("#quickedit-rename")).val("Raus_goingtocancel_TS:"+cancel_time);
                $(".btn",$("#quickedit-rename")).click();
                setTimeout(function(){
                    $("th a",$("#content_value")).first().click();
                    $(".rename-icon").click();
                    $('[type="text"]',$("#quickedit-rename")).val("Raus_Canceled_"+cancel_time);
            		    $(".btn",$("#quickedit-rename")).click();
                    location.href=cancel_link;
                },cancel_time-Date.now());
            }else if(cancel_time-Date.now()<0){ // bereits abgelaufen
                location.href=cancel_link;
            }else{
                return;
            }//Script-Abbruch falls keine abbruchzeit gefunden
        }else{
            return;
        }
        table.prepend($("<div>").attr("class","error_box").text("Fenster nicht Schließen! Dieser Befehl wird durch das Rausstellscript in kurzer Zeit abgebrochen."));
    }
    function readNextIncs(){
      var table   = $("#incomings_table");
      var rows 	= $("tr",table).slice(1);
      var row;
      var current = -1;

      (function tick(){
          if(!autoRun) {
              console.log("'Raussteller' not running..")
              return;
          }
          current ++;
          row=rows[current];
          var config = JSON.parse(storageGet("config"));
          if(getTimeLeft(row)<=config.rereadtime*60){ //6 minuten
              if(getAttackType(row)=="support"){
                  tick(); //überspringen
              }
              var id = getVillageID(row);
              var koords = getVillageKoords(row);
              console.log("id: "+id+", koords: "+JSON.stringify(koords));
              koords = nearestTarget(koords);
              var timestamp = Date.now() + getTimeLeft(row)*1000;

              var incs = JSON.parse(storageGet("incs"));
              incs[getIncID()] = {"village_id":id,"koords":koords,"timestamp":timestamp};
              storageSet("incs",JSON.stringify(incs));

              //var link = "/game.php?village="+id+"&screen=place&x="+koords.x+"&y="+koords.y+"&raus=1";
              //window.open(link, '_blank');
              tick(); //next line
          }else{
              console.log("Canceling readNextIncs; No further incoms in next few minutes");
              return;
          }
          //TODO nächste zeile, bei abbruchbedingung / spezielle umbennenung des eingehenden Angriffs
      })();

    }
    function planAtts(){
      //erzeugt aus den ausgelesenen Incs rausstellangriffe mit der dorf ID, spätester Abschickzeit und frühster Ankunft als timestamp, sowie Zielkoordinaten
      var incs = JSON.parse(storageGet("incs"));
      var config = JSON.parse(storageGet("config"));
      var atts_on_village = JSON.parse(storageGet("planned_atts"));
      for(var inc_id in incs){
        atts_on_village[incs[inc_id].village_id] = atts_on_village[incs[inc_id].village_id]==undefined?[]:atts_on_village[incs[inc_id].village_id];//erzeuge dieses array wenn nicht vorhanden
        atts_on_village[incs[inc_id].village_id].push({"koords":incs[inc_id].koords,"start":incs[inc_id].timestamp,"end":incs[inc_id].timestamp,"inc_id":[inc_id]});
      }
      for(var v_id in atts_on_village){
        //Vergleiche jeden angriff auf ein dorf mit allen anderen, ob zu nah beinander
        for(var i=0;i<atts_on_village[v_id].length;i++){
          for(var j=i+1;j<atts_on_village[v_id].length;j++){
            var start_i = atts_on_village[v_id][i].start;
            var start_j = atts_on_village[v_id][j].start;
            var end_i = atts_on_village[v_id][i].end;
            var end_i = atts_on_village[v_id][j].end;

            if(start_j<end_i+config.criticaltime||(start_i>start_j&&start_i<end_j+config.criticaltime)){
              //wenn angriffe zu nah sind: zusammenfassen und j-angriff löschen
              atts_on_village[v_id][i].start = atts_on_village[v_id][i].start<atts_on_village[v_id][j].start?atts_on_village[v_id][i].start:atts_on_village[v_id][i].start;
              atts_on_village[v_id][i].end = atts_on_village[v_id][i].end>atts_on_village[v_id][j].end?atts_on_village[v_id][i].end:atts_on_village[v_id][j].end;
              atts_on_village[v_id][i].inc_id.concat(atts_on_village[v_id][j].inc_id)
              atts_on_village[v_id][j].splice(j,1);
              j--;
            }
          }
        }
      }
      storageSet("planned_atts",JSON.stringify(atts_on_village));
    }


    function getPseudoServerTime(){
      //returns time in sek.
      var text = $("#serverTime").text();
      var hour = parseInt(text);
      var min = parseInt(text.substring(text.indexOf(":")+1,text.length));
      var sek = parseInt(text.substring(text.indexOf(":",text.indexOf(":")+1)+1,text.length));
      return hour*3600+min*60+sek;
    }
    function nearestTarget(koords){
        //returns koords of nearest target
        var distance	= 0;
        var best		= "";
        var target_list = JSON.parse(storageGet("target_list"));

        for(var name in target_list){
            //Satz des Pythagoras..
            target_list[name].distance 	= 0;
            for(var axis in koords){
                target_list[name].distance += Math.pow(parseInt(koords[axis])-parseInt(target_list[name][axis]),2);
                //distance[name]	+= Math.pow(parseInt(koords[axis])-parseInt(target_list[name][axis]),2)
            }
            target_list[name].distance	= Math.sqrt(target_list[name].distance);
            //best = best!="" ? (distance[name]<distance[best] ? name : bets) : name ;
            best 	= best== "" ? name : best;
            best	= target_list[best].distance<target_list[name].distance ? best : name;
        }
        return target_list[best];


    }
    function getAttackType(row){
        var cell = $("td",row).eq(0);
        var src = $("img",cell).first().attr("src");
        return src.substring(src.indexOf("command/")+8,src.length-4);
    }
    function getVillageID(row){
        var cell = $("td",row).eq(1);
        var link = $("a",cell).attr("href");
        var id   = parseInt(link.substring(link.indexOf("village=")+8));
        return id;
    }
    function getVillageKoords(row){
        var cell = $("td",row).eq(1);
        var text = $("a",cell).text();
        var tab = text.match(/\w+/g);
        var koords = {
            "x":    parseInt(
                        tab[tab.length-3]
                    ),
            "y":    parseInt(
                        tab[tab.length-2]
                    )
        };
        return koords;
    }
    function getTimeLeft(row){
        //returns time left in seconds.
        var cell = $("td",row).last();
        cell.css("background-color","red");
        var time = "-1";
        $("span",cell).each(function(){
            time= $(this).text();
        });
        var hour = parseInt(time.substring(0,time.indexOf(":")));
        var minute = parseInt(time.substring(time.indexOf(":")+1,time.indexOf(":",time.indexOf(":")+1)));
        var second = parseInt(time.substring(time.indexOf(":",time.indexOf(":")+1)+1,time.length));
        return  hour*3600+minute*60+second;
    }
    function getIncID(row){
        var cell = $("td",row).eq(0);
        var link = $("a",cell).first().attr("href");
        var id   = parseInt(link.substring(link.indexOf("id=")+3));
        return id;
    }
    function init_UI(){
        //create UI_link
        var overview_menu = $("#overview_menu");
        var option_link = $("<a>")
        .attr("href","#")
        .attr("id","option_link")
        .text("Raus!")
        .click(function(){
            toggleSettingsVisibility();
        });
        var status_symbol = $("<span>")
        .attr("title","DS_Box Status")
        .attr("id","status_symbol")
        .attr("class",getSymbolStatus())
        .prependTo(option_link);
        $("#menu_row").prepend($("<td>").attr("class","menu-item").append(option_link));

        //options popup
        var settingsDivVisible = false;
        var overlay=$("<div>")
        .css({
            "position":"fixed",
            "z-index":"99999",
            "top":"0",
            "left":"0",
            "right":"0",
            "bottom":"0",
            "background-color":"rgba(255,255,255,0.6)",
            "display":"none"
        })
        .appendTo($("body"));
        var settingsDiv=$("<div>")
        .css({
            "position":"fixed",
            "z-index":"100000",
            "left":"50px",
            "top":"50px",
            "width":"800px",
            "height":"400px",
            "background-color":"white",
            "border":"1px solid black",
            "border-radius":"5px",
            "display":"none",
            "padding":"10px"
        })
        .appendTo($("body"));
        function toggleSettingsVisibility() {
            if(settingsDivVisible) {
                overlay.hide();
                settingsDiv.hide();
            } else {
                overlay.show();
                settingsDiv.show();
            }

            settingsDivVisible=!settingsDivVisible;
        }

        //Foot
        $("<button>").text("Start/Stop").click(function(){
            toggleRunning();
        }).appendTo(settingsDiv);
        $("<button>").text("Schließen").click(function(){
            toggleSettingsVisibility();
        }).appendTo(settingsDiv);
        $("<button>").text("Anleitung").click(function(){
            window.open(_Anleitungslink, '_blank');
        }).appendTo(settingsDiv);
    }
    function toggleRunning(){
        var config = JSON.parse(storageGet("config"));
        config.running = ""+(config.running==="false");
        console.log("running set to "+config.running);
        storageSet("config",JSON.stringify(config));
        location.reload();
    }
    function getSymbolStatus(){
        if(JSON.parse(storageGet("config")).running==="true"){
            return "icon friend online";
        }else{
            return "icon friend offline";
        }
    }
    function randomInterval(min,max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function percentage_randomInterval(average,deviation){
		average=parseInt(average);
		deviation = deviation > 100 ? 1 : deviation/100;
		return randomInterval(average*(1+deviation),average*(1-deviation));
	}
    function getPageAttribute(attribute){
        //gibt die php-Attribute zurück, also z.B. von* /game.php?*&screen=report* würde er "report" wiedergeben
        //return: String, wenn nicht vorhanden gibt es eine "0" zurück
        var params = document.location.search;
        var value = params.substring(params.indexOf(attribute+"=")+attribute.length+1,params.indexOf("&",params.indexOf(attribute+"=")) != -1 ? params.indexOf("&",params.indexOf(attribute+"=")) : params.length);
        return params.indexOf(attribute+"=")!=-1 ? value : "0";
    }
});
