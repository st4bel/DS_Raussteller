// ==UserScript==
// @name        DS_Raussteller
// @namespace   de.die-staemme
// @version     0.1
// @description Stellt Truppen in angegriffenen Dörfern automatisch raus, und bricht die Angriffe ab.
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       unsafeWindow
// @match       https://*.die-staemme.de/game.php?*mode=incomings*
// @include     https://*.die-staemme.de/game.php?*screen=overview_villages*mode=incomings*
// @include     https://*.die-staemme.de/game.php?*mode=imcommings*screen=overview_villages
// @include     https://*.die-staemme.de/game.php?*screen=place*x=*y=*
// @include     https://*.die-staemme.de/game.php?*screen=place*try=confirm*
// @exclude     https://*.die-staemme.de/game.php?*subtype=supports
// @copyright   2016+, the stabel, git
// @downloadURL -
// ==/UserScript==

var _version = "0.1";
var _Anleitungslink = "#";

var _config = {"running":"false","abbruchzeit":"6","umbennenung":"---"};
var _units = ["spear","sword","axe","archer","spy","light","marcher","heavy","ram","catapult","knight","snob"];
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
    s = {"0":{"x":598,"y":387}}
    storageSet("target_list",storageGet("target_list",JSON.stringify(s)));
    storageSet("config",storageGet("config",JSON.stringify(_config)));


    var autoRun = JSON.parse(storageGet("config")).running==="true";
    init_UI();

    if(getPageAttribute("screen")=="overview_villages"&&getPageAttribute("mode")=="incomings"){
        startRunning();
    }else if (getPageAttribute("screen")=="place"&&getPageAttribute("raus")=="1") {
        onPlace();
    }

    function startRunning(){
        var table   = $("#incomings_table");
        var rows 	= $("tr",table).slice(1);
		var row;
        var current = -1;

        (function tick(){
            /*if(!autoRun) {
                console.log("'Raussteller' not running..")
                return;
            }*/
            current ++;
            row=rows[current];
            //$("td",row).css("background-color","red");

            if(true){//getTimeLeft(row)<=360){ //6 minuten
                var id = getVillageID(row);
                var koords = getVillageKoords(row);
                console.log("id: "+id+", koords: "+JSON.stringify(koords));
                var timestamp = JSON.parse(storageGet("timestamp"));
                timestamp[id]=0;//TODO
                storageSet("timestamp",JSON.stringify(timestamp));
                koords = nearestTarget(koords);

                var link = "/game.php?village="+id+"&screen=place&x="+koords.x+"&y="+koords.y+"&raus=1";
                console.log(link)
				window.open(link, '_blank');

            }else{
                return; //alle restlichen incoms kommen später an.
            }
            //TODO nächste zeile, wenn unterstützung.


        })();
    }
    function onPlace(){
        var form = $("#command-data-form");
        for(var i in _units){
            $("#unit_input_"+_units[i]).attr("value",$("#units_entry_all_"+_units[i]).text().match(/\w+/)[0]);
        }
        //$("#target_attack").click();
        console.log("click");
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
    function getVillageID(row){
        var cell = $("td",row).eq(1);
        var link = $("a",cell).attr("href");
        var id   = parseInt(link.substring(link.indexOf("village=")+8));
        return id;
    }
    function getVillageKoords(row){
        var cell = $("td",row).eq(1);
        var text = $("a",cell).text();
        var tab = text.match(/\w+/g)
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
        $("<button>").text("Schließen").click(function(){
            toggleSettingsVisibility();
        }).appendTo(settingsDiv);
        $("<button>").text("Anleitung").click(function(){
            window.open(_Anleitungslink, '_blank');
        }).appendTo(settingsDiv);
    }
    function getSymbolStatus(){
        var status = parseInt(storageGet("status"));
        if(status!=-1){
            return "icon friend online";
        }else{
            return "icon friend offline";
        }
    }
    function getPageAttribute(attribute){
        //gibt die php-Attribute zurück, also z.B. von* /game.php?*&screen=report* würde er "report" wiedergeben
        //return: String
        var params = document.location.search;
        var value = params.substring(params.indexOf(attribute+"=")+attribute.length+1,params.indexOf("&",params.indexOf(attribute+"=")) != -1 ? params.indexOf("&",params.indexOf(attribute+"=")) : params.length);
        return params.indexOf(attribute+"=")!=-1 ? value : "0";
    }
});
