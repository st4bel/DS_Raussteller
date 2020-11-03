// ==UserScript==
// @name        DS_Raussteller_PL
// @namespace   de.die-staemme
// @version     0.3.2
// @description Stellt Truppen in angegriffenen Dörfern automatisch raus, und bricht die Angriffe ab.
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       unsafeWindow
// @match       https://*.plemiona.pl/game.php?
// @include     https://*.plemiona.pl/game.php?*screen=overview_villages*mode=incomings*
// @include     https://*.plemiona.pl/game.php?*mode=imcommings*screen=overview_villages
// @include     https://*.plemiona.pl/game.php?*screen=place*
// @include     https://*.plemiona.pl/game.php?*screen=place*try=confirm*
// @include     https://*.plemiona.pl/game.php?*screen=info_command*
// @include     https://*.plemiona.pl/game.php?*
// @exclude     https://*.plemiona.pl/game.php?*subtype=supports*
// @copyright   2016+, the stabel, git
// @downloadURL -
// ==/UserScript==

/*
 * V 0.1: Beginn der Implementierung
 * V 0.2: Unabhängigkeit von site reload. Timungen per
 * V 0.3: Truppenvorlagen für Rausstellen -> Fakeschutz
 */

var _version = "0.3.1";
var _Anleitungslink = "http://blog.ds-kalation.de/?p=68";
var _UpdateLink = "https://github.com/st4bel/DS_Raussteller/releases";

var _config = {"running":"false","debug":"false","umbennenung":"---","units":"no_archer","rereadtime":20,"criticaltime":30,"frontbuffer":2,"backbuffer":2};
var _units = {
    "normal":["spear","sword","axe","archer","spy","light","marcher","heavy","ram","catapult","knight","snob"],
    "no_archer":["spear","sword","axe","spy","light","heavy","ram","catapult","knight","snob"],
    "no_knight":["spear","sword","axe","archer","spy","light","marcher","heavy","ram","catapult","snob"],
    "no_archer_knight":["spear","sword","axe","spy","light","heavy","ram","catapult","snob"]
};
$(function(){

    var storage = localStorage;
    var storagePrefix="raussteller_v0.3.1+_";
    //Speicherfunktionen
    function storageGet(key,defaultValue) {
        var value= storage.getItem(storagePrefix+key);
        return (value === undefined || value === null) ? defaultValue : value;
    }
    function storageSet(key,val) {
        storage.setItem(storagePrefix+key,val);
    }
    storageSet("auto_run",storageGet("auto_run","false"));
    var s = {"0":{"x":500,"y":500}};
    storageSet("target_list",storageGet("target_list",JSON.stringify(s)));
    storageSet("config",storageGet("config",JSON.stringify(_config)));
    s = {"0":0};
    storageSet("timestamp",storageGet("timestamp",JSON.stringify(s)));
    storageSet("incs",storageGet("incs","{}"));
    s = {0:[{"koords":{x:0,y:0},"start":0,"end":0,"inc_id":[0],"flag":"false"}]};
    storageSet("planned_atts",storageGet("planned_atts",JSON.stringify(s)));
    storageSet("template",storageGet("template",""))

    add_log("init_UI");
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
    if (getPageAttribute("screen")=="place"&&getPageAttribute("mode")=="templates"){
      onTemplateOverview();
    }
    function onTemplateOverview(){
      add_log("onTemplateOverview");
      //adding template_UI
      var verify_button = $("#template_button")
      $("<input>").attr("class", "btn").attr("value","Für Raussteller benutzen").insertAfter(verify_button)
      .click(function(){
        var template_id = $("a",$("li.selected",$("#troop_template_list"))).attr("href");
        var template_name = $("a",$("li.selected",$("#troop_template_list"))).text();
        if (template_id.split("#")[1] == ""){
          //return if in "create Template"
          add_log("not in viable template")
          return;
        }
        add_log("set template to: "+template_name+template_id)
        storageSet("template",template_name+template_id);
      });
    }
    function onOverview(){
        add_log("onOverview");
        var table   = $("#incomings_table");
        var rows 	= $("tr",table).slice(1);
		    var row;
        var current = -1;
        var config = JSON.parse(storageGet("config"));

        (function tick(){
            if(!autoRun) {
                add_log("'Raussteller' not running..");
                return;
            }
            current = current > 1000?1:current + 1;
            add_log("tick #"+current);
            readNextIncs();
            deleteOldIncs();
            //geplante Atts ausführen, wenn in den Nächsten 1,5 Ticks fällig
            var planned_atts = JSON.parse(storageGet("planned_atts"));
            add_log("handling planned atts...");
            for(var v_id in planned_atts){
              for(var i = 0; i<planned_atts[v_id].length;i++){
                add_log("v_id: "+v_id+", i: "+i+", if(time): "+(planned_atts[v_id][i].start<Date.now()+(config.criticaltime+2*config.frontbuffer)*1000)+", if(flag): "+(planned_atts[v_id][i].flag!=="true"));
                if((planned_atts[v_id][i].start<Date.now()+(config.criticaltime+2*config.frontbuffer)*1000)&&(planned_atts[v_id][i].flag!=="true")){//innerhalb der nächsten criticaltime
                  add_log("prepare new att...");
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
            add_log("pa "+JSON.stringify(planned_atts));
            storageSet("planned_atts",JSON.stringify(planned_atts));
            //alert("warte "+JSON.stringify(planned_atts));
            if(current%5==0){//jeder 5. Tick, muss theoretisch nur einmal in jeder config.rereadtime durchgeführt werden
              planAtts();
              /*if(current==0){//da im ersten durchlauf angriffe erst nach dem theoretischen Losschicken berechnet werden, sofort neustarten
                tick();
              }*/
            }

            setTimeout(function(){//alle 0.5*criticaltime aktualisieren
              tick();
            },percentage_randomInterval(1000*config.criticaltime,5));
        })();
        if($("th",table).eq(0).text().indexOf("zuletzt aktualisiert")==-1){//TODO ergibt derzeit noch keinen sinn..
            $("th",table).eq(0).text($("th",table).eq(0).text()+" zuletzt aktualisiert: "+$("#serverTime").text());
        }
    }
    function onPlaceSend(){//TODO unterscheidung alle, keine, einige truppen
        add_log("trying to evacuate all units..");
        var template = storageGet("template")
        if (template != ""){
          add_log("template "+template+" set.")
          try{
            TroopTemplates.useTemplate(template.split("#")[1])
          }
          catch(err){
            add_log("couldnt set template. removing template")
            storageSet("template", "");
            onPlaceSend();
          }
        }else{
          add_log("no template set. evacuate all units")
          var form = $("#command-data-form");
          var config = JSON.parse(storageGet("config"));
          var units = _units[config.units]; //shorter...
          for(var i in units){
              $("#unit_input_"+units[i]).attr("value",$("#unit_input_"+units[i]).attr("data-all-count"));
          }
        }
        add_log("click");
        setTimeout(function(){
            $("#target_attack").click();
        },randomInterval(400,600));
    }
    function onPlaceCancel(){
        add_log("find outgoing attacks to cancel...");
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
        add_log("no att to cancel found...");
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
        waitToSend();
        function waitToSend(){
          if(timestamp.start-Date.now()>config.frontbuffer*1000){//noch nicht sendebereit, dann in viertel frontbuffer-schritten zur Losschick-Zeit
            add_log("Waiting... starttime: "+timestamp.start+", dif: "+(timestamp.start-Date.now()));
            setTimeout(function(){
              waitToSend();
            },config.frontbuffer*250);
          }else{//Zeit ist ready
            $("#troop_confirm_go").click();
          }
        }
    }
    function onInfoCommand(){
        add_log("onInfoCommand")
        var table = $("#content_value");
        var cancel_link;
        $("a",table).each(function(){
            if($(this).attr("href").indexOf("action=cancel")!=-1){
                cancel_link = $(this).attr("href")+"&raus=2"; //raus=2 hinweiß zum fenster schließen
            }
        });
        if(cancel_link!=undefined){ //falls abbrechen noch möglich
            var cancel_time = parseInt($("#command_comment").text().substring($("#command_comment").text().indexOf("TS:")+3,$("#command_comment").text().length));
            if(cancel_time-Date.now()>0){ //läuft noch ab
                add_log("Canceling this attack in "+Math.round((cancel_time-Date.now())/1000)+" sek.");
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
      add_log("reading next incs...");
      var table   = $("#incomings_table");
      var rows 	= $("tr",table).slice(1);
      var row;
      var current = -1;
      nextrow();
      function nextrow(){
          current ++;
          row=rows[current];
          var config = JSON.parse(storageGet("config"));
          add_log("row: "+current+", timeleft: "+getTimeLeft(row)+", config: "+(config.rereadtime*60));
          if(getTimeLeft(row)<=config.rereadtime*60){ //6 minuten
              if(getAttackType(row)=="support"){
                  nextrow(); //überspringen
              }
              var id = getVillageID(row);
              var koords = getVillageKoords(row);
              add_log("inc found; id: "+id+", koords: "+JSON.stringify(koords));
              koords = nearestTarget(koords);
              add_log("found nearest target: "+JSON.stringify(koords));
              var timestamp = Date.now() + getTimeLeft(row)*1000;

              var incs = JSON.parse(storageGet("incs"));
              incs[getIncID(row)] = {"village_id":id,"koords":koords,"timestamp":timestamp};
              storageSet("incs",JSON.stringify(incs));
              add_log("searching for more incs...");
              nextrow(); //next line
          }else{
              add_log("Canceling readNextIncs; No further incoms in next few minutes");
              return;
          }
          //TODO nächste zeile, bei abbruchbedingung / spezielle umbennenung des eingehenden Angriffs
      }

    }
    function deleteOldIncs(){
      //löscht Incs, die beriets abgelaufen sind.
      var incs = JSON.parse(storageGet("incs"));
      add_log("deleting old incs... "+JSON.stringify(incs));
      var counter = 0;
      for(var inc_id in incs){
        if(incs[inc_id].timestamp<Date.now()){
          delete incs[inc_id];
          counter++;
        }
      }
      storageSet("incs",JSON.stringify(incs));
      add_log("deleted "+counter+" inc(s)! "+JSON.stringify(incs));
      counter=0;
      add_log("deleting old planned_atts...");
      var planned_atts = JSON.parse(storageGet("planned_atts"));
      for(var v_id in planned_atts){
        for(var i in planned_atts[v_id]){
          if(planned_atts[v_id][i].start<Date.now()){
            planned_atts[v_id].splice(i,1);
            i--;
            counter++;
          }
        }
        if(planned_atts[v_id].length==0){
          delete planned_atts[v_id];
        }
      }
      storageSet("planned_atts",JSON.stringify(planned_atts));
      add_log("deleted "+counter+" atts... ");
    }
    function planAtts(){
      //erzeugt aus den ausgelesenen Incs rausstellangriffe mit der dorf ID, spätester Abschickzeit und frühster Ankunft als timestamp, sowie Zielkoordinaten
      add_log("planning atts...");
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
            add_log("first: "+(atts_on_village[v_id][j].start<atts_on_village[v_id][i].end+config.criticaltime*1000)+", second: "+(atts_on_village[v_id][i].start>atts_on_village[v_id][j].start)+", third: "+(atts_on_village[v_id][i].start<atts_on_village[v_id][j].end+config.criticaltime*1000))
            if(atts_on_village[v_id][j].start<atts_on_village[v_id][i].end+config.criticaltime*1000||(atts_on_village[v_id][i].start>atts_on_village[v_id][j].start&&atts_on_village[v_id][i].start<atts_on_village[v_id][j].end+config.criticaltime*1000)){
              //wenn angriffe zu nah sind: zusammenfassen und j-angriff löschen
              atts_on_village[v_id][i].start = atts_on_village[v_id][i].start<atts_on_village[v_id][j].start?atts_on_village[v_id][i].start:atts_on_village[v_id][i].start;
              atts_on_village[v_id][i].end = atts_on_village[v_id][i].end>atts_on_village[v_id][j].end?atts_on_village[v_id][i].end:atts_on_village[v_id][j].end;
              atts_on_village[v_id][i].flag = atts_on_village[v_id][j].flag === "true" ? "true" : atts_on_village[v_id][i].flag;
              atts_on_village[v_id][i].inc_id.concat(atts_on_village[v_id][j].inc_id);
              atts_on_village[v_id].splice(j,1);
              j--;
            }
          }
        }
      }
      storageSet("planned_atts",JSON.stringify(atts_on_village));
      add_log("finished planning atts!");
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
        add_log("getVillageID: "+id);
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
        //cell.css("background-color","red");
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
        add_log("getting inc id...");
        var cell = $("td",row).eq(0);
        var link = $("a",cell).first().attr("href");
        var id   = parseInt(link.substring(link.indexOf("id=")+3));
        add_log("got inc id: "+id);
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
            "width":"500px",
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
        //Head
        $("<h2>").text("Einstellungen DS_Raussteller").appendTo(settingsDiv);
        $("<span>").text("Version: "+_version+" ").appendTo(settingsDiv);
        $("<button>").text("Update").click(function(){
            window.open(_UpdateLink,'_blank');
        }).appendTo(settingsDiv);
        //Body
        var settingsTable=$("<table>").appendTo(settingsDiv);
        function addRow(desc,content){
          $("<tr>")
          .append($("<td>").append(desc))
          .append($("<td>").append(content))
          .appendTo(settingsTable);
        }
        var select_units = $("<select>")
    		.append($("<option>").text("Alle").attr("value","normal"))
        .append($("<option>").text("Alle außer Bögen").attr("value","no_archer"))
        .append($("<option>").text("Alle außer Paladin").attr("value","no_knight"))
        .append($("<option>").text("keine Bögen sowie Paladin").attr("value","no_archer_knight"))
        .change(function(){
          var config = JSON.parse(storageGet("config"));
          config.units = $("option:selected",$(this)).val();
          storageSet("config",JSON.stringify(config));
        });
    		$("option[value="+JSON.parse(storageGet("config")).units+"]",select_units).prop("selected",true);

        var input_rereadtime = $("<input>")
    		.attr("type","text")
    		.val(JSON.parse(storageGet("config")).rereadtime)
    		.on("input",function(){
          var config = JSON.parse(storageGet("config"));
          if(parseInt($(this).val())>Math.ceil(config.criticaltime/30)){ // reread > 2*critical (vorsichtig)
            config.rereadtime = parseInt($(this).val());
            storageSet("config",JSON.stringify(config));
          }
    		});
        var input_criticaltime = $("<input>")
    		.attr("type","text")
    		.val(JSON.parse(storageGet("config")).criticaltime)
    		.on("input",function(){
          if(parseInt($(this).val())>0){
            var config = JSON.parse(storageGet("config"));
            config.criticaltime = parseInt($(this).val());
            storageSet("config",JSON.stringify(config));
          }
    		});
        var input_buffertime = $("<input>")
    		.attr("type","text")
    		.val(JSON.parse(storageGet("config")).frontbuffer)
    		.on("input",function(){
          if(parseInt($(this).val())>0){
            var config = JSON.parse(storageGet("config"));
            config.frontbuffer = parseInt($(this).val());
            config.backbuffer = parseInt($(this).val());
            storageSet("config",JSON.stringify(config));
          }
    		});
        var select_debug = $("<select>")
    		.append($("<option>").text("Aus").attr("value","false"))
        .append($("<option>").text("An").attr("value","true"))
        .change(function(){
          var config = JSON.parse(storageGet("config"));
          config.debug = $("option:selected",$(this)).val();
          storageSet("config",JSON.stringify(config));
          console.log(storageGet("config"))
        });
        var input_target_x = $("<input>")
        .attr("type", "text")
        .val(JSON.parse(storageGet("target_list"))["0"]["x"])
        .on("input", function(){
          if(parseInt($(this).val())>0) {
            var target_list = JSON.parse(storageGet("target_list"));
            target_list["0"]["x"] = $(this).val();
            storageSet("target_list", JSON.stringify(target_list))
          }
        })
        var input_target_y = $("<input>")
        .attr("type", "text")
        .val(JSON.parse(storageGet("target_list"))["0"]["y"])
        .on("input", function(){
          if(parseInt($(this).val())>0) {
            var target_list = JSON.parse(storageGet("target_list"));
            target_list["0"]["y"] = $(this).val();
            storageSet("target_list", JSON.stringify(target_list))
          }
        })

    		$("option[value="+JSON.parse(storageGet("config")).debug+"]",select_debug).prop("selected",true);

        $("<tr>").append($("<td>").attr("colspan",2).append($("<span>").attr("style","font-weight: bold;").text("Allgemein:"))).appendTo(settingsTable);
        addRow(
    		$("<span>").text("Einheiten auf dieser Welt: "),
    		select_units);
        addRow(
        $("<span>").text("Debugmodus: "),
    		select_debug);
        $("<tr>").append($("<td>").attr("colspan",2).append($("<span>").attr("style","font-weight: bold;").text("Zeiten:"))).appendTo(settingsTable);
        addRow(
    		$("<span>").text("Die nächsten x Minuten einlesen: "),
    		input_rereadtime);
        addRow(
    		$("<span>").text("Feindliche Angriffe, die weniger \nals x Sekunden entfernt sind zusammenfassen:"),
    		input_criticaltime);
        addRow(
    		$("<span>").text("'Angstsekunden' (>0): "),
    		input_buffertime);
        addRow(
          $("<span>").text("Rausstell-Ziel"),
          $("<div>").append(input_target_x).append(input_target_y)
        );
        addRow($("<span>").text("Derzeitige Vorlage:"),
        $("<span>").text(storageGet("template").split("#")[0] != "" ? storageGet("template").split("#")[0] : "Keine Vorlage Ausgewählt")
        );
        addRow($("<span>").text("Vorlage zurücksetzen:"),
        $("<button>").text("Klick!").click(function(){
          storageSet("template", "");
        })
        );

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
        add_log("running set to "+config.running);
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
    function add_log(text){
      if(JSON.parse(storageGet("config")).debug==="true"){
        var prefix = storagePrefix+timeConverter(Date.now())+" - ";
        console.log(prefix+text);
      }
    }
    function timeConverter(timestamp){
      var a = new Date(timestamp);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var year = a.getFullYear();
      var month = months[a.getMonth()];
      var date = a.getDate();
      var hour = a.getHours();
      var min = a.getMinutes();
      var sec = a.getSeconds();
      var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
      return time;
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
