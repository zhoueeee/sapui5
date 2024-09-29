sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "sap/ui/core/routing/History",
    "sap/viz/ui5/controls/Popover",
    "sap/viz/ui5/data/MeasureDefinition",
    "sap/viz/ui5/data/DimensionDefinition",
    "sap/viz/ui5/controls/VizSlider"
  ],
  function (BaseController, Filter, FilterOperator, JSONModel, VizFrame, FlattenedDataset, FeedItem, History, Popover
    , MeasureDefinition, DimensionDefinition, VizSlider
  ) {
    "use strict";

    return BaseController.extend("zdemowithpar.controller.CEBCA.vizframeCEBCALargeView", {
      oVizFrame: null,
      onInit() {
        this.getOwnerComponent().getRouter().getRoute("vizframeCEBCA").attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched(oEvent) {
        this._bNavigationInProgress = false
        this._sVizType = 'info/dual_combination';
        this.loadData(oEvent);
      },

      loadData: async function (oEvent) {
        try {
          let oModel = this.getOwnerComponent().getModel();
          const oCESATModel = this.getOwnerComponent().getModel('ZSD_CESAT_001');
          const oCEBCAModel = this.getOwnerComponent().getModel('ZSD_CEBCA_001');
          let oYearSelect = this.byId('idYearSelect');
          let oWeekSelect = this.byId("idWeekSelect");

          // 1. 绑定年数据 
          oYearSelect.setModel(oCESATModel);
          oYearSelect.bindItems({
            path: '/year',
            sorter: {
              path: 'Zyear',
              descending: false
            },
            template: new sap.ui.core.Item({
              key: "{Zyear}",
              text: "{Zyear}"
            })
          });

          // 确保年数据加载完毕
          await new Promise((resolve, reject) => {
            const oBinding = oYearSelect.getBinding("items");
            if (oBinding) {
              oBinding.attachDataReceived(function () {
                resolve(); // 年数据加载完成
              });
            } else {
              reject("Year binding failed");
            }
          });
          // 设置默认选中的值 
          const oArgs = oEvent.getParameter("arguments");
          const sSelectYears = oArgs.years;
          const sSelectWeek = oArgs.week;

          var aSelectedYearKeys = sSelectYears.match(/.{1,4}/g);
          oYearSelect.setSelectedKeys(aSelectedYearKeys);

          // 2. 绑定周数据并过滤当前年份
          oWeekSelect.setModel(oCESATModel);
          const oFilter = new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, aSelectedYearKeys[0]);
          oWeekSelect.bindItems({
            path: '/yearweek',
            sorter: {
              path: 'Zweek',
              descending: false
            },
            template: new sap.ui.core.Item({
              key: "{Zweek}",
              text: "{Zweek}"
            })
          });

          // 确保周数据根据年份过滤后加载完毕
          await new Promise((resolve, reject) => {
            const oBinding = oWeekSelect.getBinding("items");
            if (oBinding) {
              oBinding.filter([oFilter]); // 过滤当前年份
              oBinding.attachDataReceived(() => {
                resolve(); // 周数据加载完成
              });
            } else {
              reject("Week binding failed");
            }
          });

          // 3. 设置周的默认值
          oWeekSelect.setSelectedKey(sSelectWeek);

          // 4. 使用 CEBCA 模型加载图表数据
          this.getOwnerComponent().getModel('ZSB_CEBCA_001').metadataLoaded().then(() => {
            const sPath = "/yearcurrrate(p_ZWEEK='" + sSelectWeek + "')/Set";
            var aYearFilters = aSelectedYearKeys.map(function (year) {
              return new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year);
            });
            // 创建组合 Filter，使用 AND: false（即 OR）
            var oYearCombinedFilter = new sap.ui.model.Filter({
              filters: aYearFilters,
              and: false
            });
            this.getOwnerComponent().getModel('ZSB_CEBCA_001').read(sPath, {
              filters: [oYearCombinedFilter],
              success: (oData) => {
                this._drawCEBCAChart(this._transformCEBCAData(oData.results, aSelectedYearKeys), aSelectedYearKeys, 'idVizframeCEBCA'); // 绘制图表
              },
              error: (oError) => {
              }
            });
          });
        } catch (oError) {

        }

      },

      _transformCEBCAData(odataResult, years) {
        const result = [];
        const map = new Map();
        const maxYear = Math.max(...years.map(Number)); //20240929
        odataResult.forEach((item) => {
          const key = item.waers;
          if (!map.has(key)) {
            let newObj = {
              waers: item.waers
            };
            years.forEach(year => {
              newObj[year] = 0.00;
              newObj[`${year}prop`] = 0.0000
            });
            map.set(key, newObj);
          }
          const amountDivided = (parseFloat(item.usdamount) / 10000).toFixed(0); //20240929
          map.get(key)[item.Zyear] = amountDivided;
          map.get(key)[`${item.Zyear}prop`] = Number(item.currprop).toFixed(4);
        });

        result.push(...map.values());
        result.sort((a, b) => Number(b[maxYear]) - Number(a[maxYear]));//20240929
        return {
          result: result
        };;
      },


      onYearChangeFinish: function (oEvent) {
        const sSelectedYearKeys = oEvent.getSource().getSelectedKeys();
        const maxYear = Math.max(...sSelectedYearKeys.map(Number));
        const oWeekSelect = this.byId("idWeekSelect")
        const oFilter = new Filter("Zyear", FilterOperator.EQ, maxYear);
        const oBinding = oWeekSelect.getBinding("items");
        oBinding.filter([oFilter]);

        let sWeekSelect = oWeekSelect.getSelectedKey();
        oBinding.attachEventOnce('dataReceived', (oEvent) => {
          const oData = oEvent.getParameter("data");
          if (oData && oData.results && oData.results.length > 0) {
            const bExists = oData.results.some(function (item) {
              return item['Zweek'] === sWeekSelect;
            });

            if (!bExists) {
              sWeekSelect = '1'
            }
          }

          const oDataModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
          this._fetchAndDrawCESATData(oDataModel, sWeekSelect, sSelectedYearKeys);
        })

      },

      _fetchAndDrawCESATData: function (oCESATModel, sCurrentWeek, aSelectedYearKeysStr) {
        return new Promise((resolve, reject) => {
          // 异步操作逻辑
          oCESATModel.metadataLoaded().then(() => {
            const sPath = "/CESAT(p_ZWEEK='" + sCurrentWeek + "')/Set";
            const aYearFilters = aSelectedYearKeysStr.map(year => new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year));
            const oYearCombinedFilter = new sap.ui.model.Filter({ filters: aYearFilters, and: false });

            oCESATModel.read(sPath, {
              filters: [oYearCombinedFilter],
              success: (oData) => {
                this._drawChart(this._transformData(oData.results, aSelectedYearKeysStr), aSelectedYearKeysStr);
                resolve();
              },
              error: (oError) => {
                reject(oError);
              }
            });
          });
        });
      },

      onWeekChanged: function (oEvent) {
        const sWeekSelect = oEvent.getSource().getSelectedKey();
        const sSelectedYearKeys = this.byId('idYearSelect').getSelectedKeys();
        const oDataModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
        this._fetchAndDrawCESATData(oDataModel, sWeekSelect, sSelectedYearKeys, 'idVizframeCESAT');
      },

      _drawCEBCAChart(oData, ayears, idVizframe) {
        const FIORI_PERCENTAGE_FORMAT_2 = "__UI5__PercentageMaxFraction2";
        const chartFormatter = sap.viz.ui5.format.ChartFormatter.getInstance();
        // 注册自定义格式器，百分比格式
        chartFormatter.registerCustomFormatter(FIORI_PERCENTAGE_FORMAT_2, function (value) {
          var percentage = sap.ui.core.format.NumberFormat.getPercentInstance({
            style: 'precent',
            maxFractionDigits: 2
          });
          return percentage.format(value);
        });
        //必需要的不然轴的标签会不显示
        sap.viz.api.env.Format.numericFormatter(chartFormatter);

        const oJsonModel = new JSONModel(oData);
        const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
        let oVizFrame = this.oVizFrames[idVizframe];

        if (!oVizFrame) {
          oVizFrame = new VizFrame(idVizframe, {
            'width': '100%',
            'height': '280px',
            'uiConfig': {
              'applicationSet': 'fiori'
            }
          });
          const oGridChart = this.byId("idGridChart");
          oGridChart.addContent(oVizFrame);
          this.oVizFrames[idVizframe] = oVizFrame;

          oVizFrame.attachBrowserEvent("click", function (oEvent) {
            //const sSelectYear = this.byId('idYearSelect').getSelectedKeys().join('');
            //const sSelectWeek = this.byId('idWeekSelect').getSelectedKey()
            //this.getOwnerComponent().getRouter().navTo('vizframeCEBCA', { years: sSelectYear, week: sSelectWeek }, false);
          }.bind(this))
        }

        oVizFrame.setVizProperties({
          interaction: {
            noninteractiveMode: true,
            syncValueAxis: false
          },
          scales: {
            valueAxis: {
              max: 100,
              min: 0
            }
          },
          plotArea: {
            primaryValuesColorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
            secondaryValuesColorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
            drawingEffect: 'glossy',
            dataLabel: {
              visible: true,
              hideWhenOverlap: true,
              renderer: function (oEvent) {
                if (oEvent.ctx.measureNames.includes(oResourceBundle.getText('proportion'))) {
                  oEvent.text = oEvent.val * 100 + '%';
                } else {
                  debugger
                  oEvent.text = oEvent.val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                }
              },
              style: {
                fontSize: "8px", // 字体大小  
              }
            },
            dataShape: {
              primaryAxis: ayears.map(year => 'bar'),
              secondaryAxis: ayears.map(year => 'line')
            },
            //自动会让双YY轴自动对齐，所以不要人为设置第二轴
            /* secondaryScale:{
                minValue:0,
                maxValue:1,
                fixedRange: true
            },  */
            window: {
              //start: 'firstDataPoint',
              //end: 'lastDataPoint'
            }
          },
          title: {
            text: oResourceBundle.getText('titleofCEBCAchart')
          },
          valueAxis: {
            label: {
              formatString: '###,##0' //20240929 
            },
            title: {
              visible: false
            },
            axisLine: { visible: true },
            axisTick: { visible: true },
            visible: true
          },
          valueAxis2: {
            label: {
              formatString: FIORI_PERCENTAGE_FORMAT_2
            },
            title: {
              visible: false
            },
            axisLine: { visible: true },
            axisTick: { visible: true },
            visible: true
          }
        });

        oVizFrame.setModel(oJsonModel, 'viewModel');

        const aMeasuresYear = ayears.map(year => new MeasureDefinition({
          name: year,
          value: `{viewModel>${year}}`
        }));

        const aMeasuresProp = ayears.map(year => new MeasureDefinition({
          name: `${year}${oResourceBundle.getText('proportion')}`,
          value: `{viewModel>${year}prop}`,
          unit: '%'
        }));

        const oDataset = new FlattenedDataset({
          dimensions: [new DimensionDefinition({
            name: oResourceBundle.getText('currency'),
            value: '{viewModel>waers}'
          })],
          measures: aMeasuresYear.concat(aMeasuresProp),
          data: {
            path: 'viewModel>/result'
          }
        });

        const feedValueAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
          uid: "valueAxis",
          type: "Measure",
          values: ayears.map(year => year)

        }), feedValueAxis2 = new sap.viz.ui5.controls.common.feeds.FeedItem({
          uid: "valueAxis2",
          type: "Measure",
          values: ayears.map(year => `${year}${oResourceBundle.getText('proportion')}`)
        }),
          categoryAxis = new sap.viz.ui5.controls.common.feeds.FeedItem({
            uid: "categoryAxis",
            type: "Dimension",
            values: [oResourceBundle.getText('currency')]
          });

        oVizFrame.destroyDataset();
        oVizFrame.setDataset(oDataset);
        oVizFrame.setVizType('info/dual_combination');

        oVizFrame.addFeed(feedValueAxis);
        oVizFrame.addFeed(feedValueAxis2);
        oVizFrame.addFeed(categoryAxis);

      },

      _createDataset: function (oResourceBundle, modelName, aYears) {
        const aMeasures = aYears.map(year => (new MeasureDefinition({
          name: year,
          value: `{${modelName}>${year}}`
        })));
        return new FlattenedDataset({
          dimensions: [new DimensionDefinition({
            name: oResourceBundle.getText('Org'),
            value: `{${modelName}>ddtext}`
          })],
          measures: aMeasures,
          data: {
            path: `${modelName}>/result`
          }
        });
      },

      _createFeedItems: function (oResourceBundle, aYears) {
        const sortedYears = aYears.sort((a, b) => Number(b) - Number(a));
        const feedValueAxis = new FeedItem({
          uid: "valueAxis",
          type: "Measure",
          values: sortedYears
        });

        const feedCategoryAxis = new FeedItem({
          uid: "categoryAxis",
          type: "Dimension",
          values: [oResourceBundle.getText('Org')]
        });

        return [feedValueAxis, feedCategoryAxis];
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
      },

      onBtnSwitchChart() {
        if (this._sVizType === 'column') {
          this._sVizType = 'bar';
        } else {
          this._sVizType = 'column';
        }
        this._drawChart(this._oData, this._ayears);
      },

      onBtnDownloadPDF: function () {

        var ctrlString = "width=800px, height=600px"; // control page size
        var wind = window.open("", "Print", ctrlString);
        var sContent = this.byId('idVizframeCESAT').exportToSVGString({
          width: window.innerWidth,
          height: window.innerheight
        });
        wind.document.write(sContent);
        wind.print();
        /*
        var oVizFrame = this.getView().byId("idVizframeCESAT");
        oVizFrame.setVizProperties({
          interaction: {
            noninteractiveMode: true
          }
        });


        var sSVG = oVizFrame.exportToSVGString({
          width: 800,
          height: 600
        });

        // UI5 library bug fix:
        //    Legend SVG created by UI5 library has transform attribute with extra space
        //    eg:   transform="translate (-5,0)" but it should be without spaces in string quotes
        //    tobe: transform="translate(-5,0)
        sSVG = sSVG.replace(/translate /gm, "translate");

        //Step 2: Create Canvas html Element to add SVG content
        var oCanvasHTML = document.createElement("canvas");
        canvg(oCanvasHTML, sSVG); // add SVG content to Canvas

        // STEP 3: Get dataURL for content in Canvas as PNG/JPEG
        var sImageData = oCanvasHTML.toDataURL("image/png");

        // STEP 4: Create PDF using library jsPDF
        var oPDF = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });
        oPDF.addImage(sImageData, "PNG", 10, 10,);
        oPDF.save("test.pdf");
        */
      }
    });
  }
);
