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
    s = {0:[{"koords":incs[inc_id].koords,"start":incs[inc_id].timestamp,"end":incs[inc_id].timestamp,"inc_id":[inc_id],"flag":"false"}]};
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
        var config = JSON.parse(storageGet("config"))

        (function tick(){
            if(!autoRun) {
                console.log("'Raussteller' not running..");
                return;
            }
            current = current > 1000?1:current + 1;
            readNextIncs();
            deleteOldIncs();
            //geplante Atts ausführen, wenn in den Nächsten 1,5 Ticks fällig
            var planned_atts = JSON.parse(storageGet("planned_atts"));
            for(var v_id in planned_atts){
              for(var i = 0; i<planned_atts[v_id].length;i++){
                if(planned_atts[v_id][i].start>Date.now()-config.criticaltime*1000&&planned_atts[v_id][i].flag!=="true"){//innerhalb der nächsten criticaltime
                  //angriff vorbereiten und öffnen
                  //script arbeitet auf allen anderen Seiten mit der localStorage variable "timestamp"
                  var timestamp = JSON.parse(storageGet("timestamp"));
                  timestamp[v_id] = {"start":(planned_atts[v_id][i].start-config.frontbuffer*1000),"cancel":(Math.floor((planned_atts[v_id][i].start-config.frontbuffer*1000+planned_atts[v_id][i].end+config.backbuffer*1000)/2)+1000)};
                  storageSet("timestamp",JSON.stringify(timestamp));

                  var link = "/game.php?village="+v_id+"&screen=place&x="+planned_atts[v_id][i].koords.x+"&y="+planned_atts[v_id][i].koords.y+"&raus=1";
				          window.open(link, '_blank');
                  //angriff aus planned_atts löschen!
                  planned_atts[v_id][i].flag="true"; //gibt an, dass dieser angriff bereits geschickt wurde..
                }
              }
            }
            storageSet("planned_atts",JSON.parse(planned_atts));
            if(current%5==0){//jeder 5. Tick, muss theoretisch nur einmal in jeder config.rereadtime durchgeführt werden
              planAtts();
              if(current==0){//da im ersten durchlauf angriffe erst nach dem theoretischen Losschicken berechnet werden, sofort neustarten
                tick();
              }
            }

            setTimeout(function(){//alle 0.5*criticaltime aktualisieren
              tick();
            },percentage_randomInterval(500*config.criticaltime,5));
        })();
        if($("th",table).eq(0).text().indexOf("zuletzt aktualisiert")==-1){//TODO ergibt derzeit noch keinen sinn..
            $("th",table).eq(0).text($("th",table).eq(0).text()+" zuletzt aktualisiert: "+$("#serverTime").text());
        }
    }
    function onPlaceSend(){//TODO unterscheidung alle, keine, einige truppen
        console.log("trying to evacuate all units..");
        var form = $("#command-data-form");
        var config = JSON.parse(storageGet("config"));
        var units = _units[config.units]; //shorter...
        for(var i in units){
            $("#unit_input_"+units[i]).attr("value",$("#unit_input_"+units[i]).attr("data-all-count"));
        }
        console.log("click");
        setTimeout(function(){
            $("#target_attack").click();
        },randomInterval(400,600));
    }
    function onPlaceCancel(){
        console.log("find outgoing attacks to cancel...");
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
                }
                if(attack_text.indexOf("Raus_Canceled_")!=-1 && (Date.now()-parseInt(attack_text.substring(attack_text.indexOf("Raus_Canceled_")+14,attack_text.length)))<10000){
                    window.close();
                }
            }
        }
        console.log("no att to cancel found...");
    }
    function onConfirm(){
        var config = JSON.parse(storageGet("config"));
        var timestamp = JSON.parse(storageGet("timestamp"))[getPageAttribute("village")];
        if(timestamp.start<Date.now()||timestamp.start==undefined){//abbruch
            return;
        }
        var attackname  = "Raus_TS:"+timestamp.cancel;
        var form  = $("#command-data-form");
        $("th a",form).first().click();
        $(".rename-icon").click();
        $('[type="text"]',form).val(attackname);
		    $("#attack_name_btn",form).click();

        (function waitToSend(){
          if(timstamp.start-Date.now()>config.frontbuffer*1000){//noch nicht sendebereit, dann in viertel frontbuffer-schritten zur Losschick-Zeit
            console.log("Waiting... starttime: "+timestamp.start+", dif: "+(timestamp.start-Date.now()));
            setTimeout(function(){
              waitToSend();
            },config.frontbuffer*250);
          }else{//Zeit ist ready
            return;
          }
        })();
        console.log("Ready to send!");
        console.log("timestamp.cancel: "+timestamp.cancel+", aktuell: "+Date.now()+", div: "+Math.round((timestamp.cancel-Date.now())/1000)+"sek.");
        $("#troop_confirm_go").click();
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
                console.log("Canceling this attack in "+Math.round((cancel_time-Date.now())/1000)+" sek.");
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
      console.logs("reading next incs...");
      var table   = $("#incomings_table");
      var rows 	= $("tr",table).slice(1);
      var row;
      var current = -1;

      (function nextrow(){
          current ++;
          row=rows[current];
          var config = JSON.parse(storageGet("config"));
          if(getTimeLeft(row)<=config.rereadtime*60){ //6 minuten
              if(getAttackType(row)=="support"){
                  nextrow(); //überspringen
              }
              var id = getVillageID(row);
              var koords = getVillageKoords(row);
              console.log("inc found; id: "+id+", koords: "+JSON.stringify(koords));
              koords = nearestTarget(koords);
              console.log("found nearest Target: "+JSON.stringify(koords));
              var timestamp = Date.now() + getTimeLeft(row)*1000;

              var incs = JSON.parse(storageGet("incs"));
              incs[getIncID()] = {"village_id":id,"koords":koords,"timestamp":timestamp};
              storageSet("incs",JSON.stringify(incs));
              console.log("searching for more incs...");
              nextrow(); //next line
          }else{
              console.log("Canceling readNextIncs; No further incoms in next few minutes");
              return;
          }
          //TODO nächste zeile, bei abbruchbedingung / spezielle umbennenung des eingehenden Angriffs
      })();

    }
    function deleteOldIncs(){
      //löscht Incs, die beriets abgelaufen sind.
      console.log("deleting old incs...");
      var incs = JSON.parse(storageGet("incs"));
      for(var inc_id in incs){
        if(incs[inc_id].timestamp>Date.now()){
          delete incs[inc_id];
        }
      }
      storageSet("incs",JSON.stringify(incs));
      console.log("deleted incs!");
    }
    function planAtts(){
      //erzeugt aus den ausgelesenen Incs rausstellangriffe mit der dorf ID, spätester Abschickzeit und frühster Ankunft als timestamp, sowie Zielkoordinaten
      console.log("planning atts...");
      var incs = JSON.parse(storageGet("incs"));
      var config = JSON.parse(storageGet("config"));
      var atts_on_village = JSON.parse(storageGet("planned_atts"));
      for(var inc_id in incs){
        atts_on_village[incs[inc_id].village_id] = atts_on_village[incs[inc_id].village_id]==undefined?[]:atts_on_village[incs[inc_id].village_id];//erzeuge dieses array wenn nicht vorhanden
        atts_on_village[incs[inc_id].village_id].push({"koords":incs[inc_id].koords,"start":incs[inc_id].timestamp,"end":incs[inc_id].timestamp,"inc_id":[inc_id],"flag":"false"});
      }
      for(var v_id in atts_on_village){
        //Vergleiche jeden angriff auf ein dorf mit allen anderen, ob zu nah beinander
        for(var i=0;i<atts_on_village[v_id].length;i++){
          for(var j=i+1;j<atts_on_village[v_id].length;j++){

            if(atts_on_village[v_id][j].start<atts_on_village[v_id][i].end+config.criticaltime||(atts_on_village[v_id][i].start>atts_on_village[v_id][j].start&&atts_on_village[v_id][i].start<atts_on_village[v_id][j].end+config.criticaltime)){
              //wenn angriffe zu nah sind: zusammenfassen und j-angriff löschen
              atts_on_village[v_id][i].start = atts_on_village[v_id][i].start<atts_on_village[v_id][j].start?atts_on_village[v_id][i].start:atts_on_village[v_id][i].start;
              atts_on_village[v_id][i].end = atts_on_village[v_id][i].end>atts_on_village[v_id][j].end?atts_on_village[v_id][i].end:atts_on_village[v_id][j].end;
              atts_on_village[v_id][i].flag = atts_on_village[v_id][j].flag === "true" ? "true" : atts_on_village[v_id][i].flag;
              atts_on_village[v_id][i].inc_id.concat(atts_on_village[v_id][j].inc_id);
              atts_on_village[v_id][j].splice(j,1);
              j--;
            }
          }
        }
      }
      storageSet("planned_atts",JSON.stringify(atts_on_village));
      console.log("finished planning atts!");
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
