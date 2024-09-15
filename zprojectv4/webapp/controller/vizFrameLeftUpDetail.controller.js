sap.ui.define([
  "sap/ui/core/mvc/Controller",
  'sap/viz/ui5/format/ChartFormatter',
  'sap/viz/ui5/api/env/Format',
  'sap/viz/ui5/controls/VizTooltip',
  "sap/ui/mdc/condition/FilterConverter",
  "sap/ui/model/FilterType",
  "sap/ui/core/routing/History",
  "sap/ui/thirdparty/sinon-4"
],
  function (Controller, ChartFormatter, Format, VizTooltip, FilterConverter, FilterType, History, sinon) {
    "use strict";

    return Controller.extend("zchart002ad.controller.vizFrameLeftUpDetail", {
      oVizFrame: null,
      oPopOver: null,
      onInit: function () {

        Format.numericFormatter(ChartFormatter.getInstance());
        var formatPattern = ChartFormatter.DefaultPattern;

        var oVizFrame = this.oVizFrame = this.getView().byId("idVizFrame");

        oVizFrame.attachSelectData(function (oEvent) {
          var selectedData = oEvent.getParameter("data");
          if (selectedData && selectedData.length) {
            var costTypeValue = oEvent.getParameters().data[0].data["Cost Type"]
            this.getOwnerComponent().getRouter().navTo(
              "CostTypeDetail", { costTypeId: costTypeValue }, false
            )
          }

        }.bind(this))

        oVizFrame.setVizProperties({
          plotArea: {
            colorPalette: ['#d32030', '#e17b24', '#61a656', '#848f94'],
            dataLabel: {
              formatString: formatPattern.SHORTFLOAT_MFD2,
              visible: true,
              hideWhenOverlap: false
            },
            drawingEffect: "glossy"
          },
          legend: {
            drawingEffect: "glossy"
          },
          categoryAxis: {
            axisTick: {
              shortTickVisible: false
            }
          },
          interaction: {
            selectability: {
              plotLassoSelection: false,
              legendSelection: true,
              axisLabelSelection: false,
              mode: "SINGLE"
            }
          }
        })
        var oTooltip = new VizTooltip({});
        oTooltip.connect(oVizFrame.getVizUid());
        oTooltip.setFormatString(formatPattern.STANDARDFLOAT);
      },
      onSearch: function () {


        /* 
         const oFilterBar = this.getView().byId('costTypeFilterbar')
         const oConditions = oFilterBar.getConditions();

         const oConditionTypes = FilterConverter.createConditionTypesMapFromFilterBar(oConditions, oFilterBar);
         const oModelFilter = FilterConverter.createFilters(oConditions, oConditionTypes);

         this.getView().byId("idVizFrame").getDataset().getBinding("data").filter(oModelFilter);
         this.getView().byId("table").getBinding("rows").filter(oModelFilter);
         */

      },
      onFiltersChanged: function () {

      },

      onExportToPDF: function () {
        var ctrlString = "width=800px, height=600px"; // control page size
        var wind = window.open("", "Print", ctrlString);
        var sContent = this.getView().byId("idVizFrame").exportToSVGString({ // read content and fit with page size
          width: window.innerWidth,
          height: window.innerheight
        });
        wind.document.write(sContent);
        wind.print();
      },
      onNavBack: function () {
        var oHistory, sPreviousHash;

        oHistory = History.getInstance();
        sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          this.getOwnerComponent().getRouter().navTo("RouteView", {}, true /*no history*/);
        }
      }
    });
  });
