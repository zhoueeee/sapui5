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

    return BaseController.extend("zdemowithpar.controller.CESAT.vizframeCESATLargeView", {
      oVizFrame: null,
      onInit() {
        this.getOwnerComponent().getRouter().getRoute("vizframeCESAT").attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched(oEvent) {
        this._bNavigationInProgress = false
        this._sVizType = 'column';
        this.loadData(oEvent);
      },

      loadData: async function (oEvent) {
        try {
          let oModel = this.getOwnerComponent().getModel();
          const oCESATModel = this.getOwnerComponent().getModel('ZSB_CESAT_001');
          let oYearSelect = this.byId('idYearSelect');
          let oWeekSelect = this.byId("idWeekSelect");

          // 1. 绑定年数据 
          oYearSelect.setModel(oModel);
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
          oWeekSelect.setModel(oModel);
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

          // 4. 使用 CESAT 模型加载图表数据
          oCESATModel.metadataLoaded().then(() => {
            const sPath = "/CESAT(p_ZWEEK='" + sSelectWeek + "')/Set";
            var aYearFilters = aSelectedYearKeys.map(function (year) {
              return new sap.ui.model.Filter("Zyear", sap.ui.model.FilterOperator.EQ, year);
            });
            // 创建组合 Filter，使用 AND: false（即 OR）
            var oYearCombinedFilter = new sap.ui.model.Filter({
              filters: aYearFilters,
              and: false
            });
            oCESATModel.read(sPath, {
              filters: [oYearCombinedFilter],
              success: (oData) => {
                this._drawChart(this._transformData(oData.results, aSelectedYearKeys), aSelectedYearKeys); // 绘制图表
              },
              error: (oError) => {
              }
            });
          });
        } catch (oError) {

        }

      },

      _transformData: function (odataResult, years) {
        const resultMap = {};
        const maxYear = Math.max(...years.map(Number)); //20240929
        odataResult.forEach(item => {
          const { Zyear, ddtext, usdamount } = item;

          if (!resultMap[ddtext]) {
            resultMap[ddtext] = { ddtext };

            years.forEach(year => {
              resultMap[ddtext][year] = "0.00";
            });
          }
          const amountDivided = (parseFloat(usdamount) / 10000).toFixed(2);
          resultMap[ddtext][Zyear] = amountDivided;
        });

        const transformedResult = Object.values(resultMap);
        transformedResult.sort((a, b) => Number(b[maxYear]) - Number(a[maxYear]));//20240929
        return {
          result: transformedResult
        };
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

      _drawChart: function (oData, ayears) {
        const oJsonModel = new JSONModel(oData);
        this._oData = oData;
        this._ayears = ayears;
        const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
        let oVizFrame = this.byId('idVizframeCESAT');
        if (!oVizFrame) {
          oVizFrame = new VizFrame(idVizframe, {
            'width': '100%',
            'height': '280px',
            'uiConfig': {
              'applicationSet': 'fiori'
            }
          });
          //const oGridChart = this.byId("idGridChart");
          //oGridChart.addContent(oVizFrame);
          this.oVizFrame = oVizFrame;
        }

        oVizFrame.setVizProperties({
          interaction: {
            noninteractiveMode: false
          },
          title: {
            text: oResourceBundle.getText('titleofchart')
          }
        })

        // 设置图表属性
        oVizFrame.setModel(oJsonModel, 'viewModel');
        oVizFrame.setVizProperties({
          interaction: {
            selectability: {
              plotStdSelection: false
            }
          },
          plotArea: {
            colorPalette: ['#FF0000', '#007BFF', '#87ceeb', '#61a656'],
            drawingEffect: 'glossy',
            dataLabel: {  //柱体字符
              visible: true,
              formatString: [['###,##0']],  //千分位逗号 //20240929
              hideWhenOverlap: true,
              style: {
                fontSize: "16px", // 字体大小  
              }
            },
            gap: {
              innerGroupSpacing: 0,
              groupSpacing: 0.7
            }
          },
          valueAxis: {
            label: {
              formatString: '###,##0',  //千分位逗号 //20240929
            }
          },
          categoryAxis: {
            label: {
              style: {
                fontSize: "16px", // 字体大小  
              }
            }
          }
        });

        // 调用创建数据集的函数
        const oDataset = this._createDataset(oResourceBundle, 'viewModel', ayears);

        // 调用创建 feedItems 的函数
        const aFeeds = this._createFeedItems(oResourceBundle, ayears);

        // 绑定数据集和类型到图表
        oVizFrame.destroyDataset();
        oVizFrame.setDataset(oDataset);
        oVizFrame.setVizType(this._sVizType);

        // 清除之前的 feeds 并添加新的 feeds
        oVizFrame.removeAllFeeds();
        aFeeds.forEach(function (feedItem) {
          oVizFrame.addFeed(feedItem);
        });

        oVizFrame.attachSelectData((oEvent) => {
          if (this._bNavigationInProgress) return;
          this._bNavigationInProgress = true;
          debugger
          //通过这个语句可以取到model中的所在行
          //oEvent.oSource.oModels.viewModel.oData.result[oEvent.getParameter("data")[0].data['_context_row_number']]  
          const sOrg = oEvent.getParameter('data')[0].data[oResourceBundle.getText('Org')];
          const sSelectYear = this.byId('idYearSelect').getSelectedKeys().join('');
          const sSelectWeek = this.byId('idWeekSelect').getSelectedKey()
          this.getOwnerComponent().getRouter().navTo('listCESATOrg', { years: sSelectYear, week: sSelectWeek, org: window.encodeURIComponent(sOrg) }, false);

        })

        //const oPopOver = new Popover();
        //oPopOver.connect(oVizFrame.getVizUid());

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
