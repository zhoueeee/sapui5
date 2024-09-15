sap.ui.define([
  "sap/ui/core/mvc/Controller",
  'sap/viz/ui5/format/ChartFormatter',
  'sap/viz/ui5/api/env/Format',
  "sap/ui/core/routing/History",
  "sap/ui/model/odata/v4/ODataModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/FilterType",
  'sap/viz/ui5/controls/VizTooltip'
],
  function (Controller, ChartFormatter, Format, History, ODataModel, Filter, FilterOperator, FilterType, VizTooltip) {
    "use strict";

    return Controller.extend("zprojectv4.controller.CostTypeDetail", {
      oVizFrame: null,
      onInit: function () {
        Format.numericFormatter(ChartFormatter.getInstance());
        var formatPattern = ChartFormatter.DefaultPattern;
        var oVizFrame = this.oVizFrame = this.getView().byId("idVizFrameDetail");
        oVizFrame.setVizProperties({
          plotArea: {
            colorPalette: ['#d32030', '#e17b24', '#61a656', '#848f94'],
            dataLabel: {
              formatString: formatPattern.STANDARDFLOAT,
              visible: true,
              hideWhenOverlap: false
            },
            drawingEffect: "glossy"
          },
          legend: {
            drawingEffect: "glossy"
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

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter.getRoute("CostTypeDetail").attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oArgs, oView;

        oArgs = oEvent.getParameter("arguments");
        oView = this.getView();
        debugger
        var oFilter = new Filter("CostTypeId", sap.ui.model.FilterOperator.EQ, oArgs.costTypeId);
        this.getView().byId("idVizFrameDetail").getDataset().getBinding("data").filter(oFilter, FilterType.Application);
        this.getView().byId("tableDetail").getBinding("rows").filter(oFilter, FilterType.Application);
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
