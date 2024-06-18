/* global Cookies */
/* global API_SERVER */
/* global deck */
/* global d3scale */
(function ($) {
  $.fn.scatterplot = function (options) {
    const defaults = {
      backgroundColor: "white", // the canvas background color
      containerId: "canvas-container", // the data point transparency
      canvasId: "canvas_plot", // the color scale usage
    };
    let cellDeck;
    let embeddingViewState;
    let currentViewState;
    let bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat;
    const settings = $.extend({}, defaults, options);
    if (this.length > 1) {
      this.each(function () {
        $(this).cellatlas(options);
      });
      return this;
    }

    window.addEventListener("resize", () => {
      cellDeck.setProps({
        width: $("#" + settings.containerId)
          .parent()
          .width(),
      });
      cellDeck.canvas.width = cellDeck.width;
      const { WebMercatorViewport } = deck;
      currentViewState = new WebMercatorViewport({
        width: cellDeck.canvas.width,
        height: currentViewState.height,
        longitude: currentViewState.longitude,
        latitude: currentViewState.latitude,
        zoom: currentViewState.zoom,
      });
      embeddingViewState = new WebMercatorViewport({
        width: cellDeck.canvas.width,
        height: embeddingViewState.height,
        longitude: embeddingViewState.longitude,
        latitude: embeddingViewState.latitude,
        zoom: embeddingViewState.zoom,
      }).fitBounds(
        [
          [bboxMinLon, bboxMinLat],
          [bboxMaxLon, bboxMaxLat],
        ],
        {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          },
        }
      );
      render();
    });

    // private variables
    const width = $("#" + settings.containerId)
      .parent()
      .width();
    const height = $(window).height() - 116;
    const datasetId = this.attr("data-datasetId");
    let xhrPool = [];
    const active = {
      dataset: {},
      bounds: {},
      samples: {},
    };
    let obsmKey;
    let colorScaleId;
    let colorScaleKey;
    let colorScaleType;
    const resources = {};
    // attach a function to be executed before an Ajax request is sent.
    $(document).ajaxSend(function (e, jqXHR, options) {
      xhrPool.push(jqXHR);
    });
    $(document).ajaxComplete(function (e, jqXHR, options) {
      xhrPool = $.grep(xhrPool, function (x) {
        return x !== jqXHR;
      });
    });

    const escapeSelector = function (s) {
      return s.replace(/(:|\.|\[|\])/g, "\\$1");
    };

    // private methods
    const startLoader = function (id) {
      $("#canvas-loader").html(
        '<div class="btn-group mb-3"><a class="btn btn-white">Loading...</a></div>'
      );
      $("#loader").html(
        '<div class="spinner"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>'
      );
      $("#canvas-controls").hide();
      $("#continuous-legend").empty();
    };

    const endLoader = function (id) {
      $("#canvas-loader").removeClass().empty();
      $("#loader").removeClass().empty();
      $("#canvas-controls").show();
    };

    const showError = function (id) {
      $("#canvas-loader").html(
        '<div class="btn-group mb-3"><a class="btn btn-white">Error</a></div>'
      );
      $("#canvas-controls").hide();
      $("#loader").removeClass().empty();
    };

    const abort = function () {
      $.each(xhrPool, function (idx, jqXHR) {
        jqXHR.abort();
      });
    };

    const decolorize = function () {
      colorScaleId = null;
      colorScaleKey = null;
      colorScaleType = null;
      Cookies.remove("ds" + datasetId + "-obs-name", {
        path: window.location.pathname,
      });
      Cookies.remove("ds" + datasetId + "-obs-id", {
        path: window.location.pathname,
      });
      Cookies.remove("ds" + datasetId + "-obs-type", {
        path: window.location.pathname,
      });
      startLoader();
      render();
      endLoader();
    };

    const getMax = function (arr) {
      let len = arr.length;
      let max = -Infinity;

      while (len--) {
        max = arr[len] > max ? arr[len] : max;
      }
      return max;
    };

    const doAjax = function (url, async = true) {
      let result;
      // return stored resource
      if (resources[url]) {
        return resources[url];
      }
      // attempt ajax call
      try {
        result = $.ajax({
          url,
          type: "GET",
          async,
        })
          .done(function () {
            resources[url] = result;
          })
          .fail(function (jqXHR, textStatus) {
            return false;
          });
        return result;
      } catch (error) {
        console.error(error);
        return false;
      }
    };

    const loadEmbedding = function () {
      $.when(
        doAjax(
          API_SERVER +
            "api/v1/coordinates?embedding=" +
            obsmKey +
            "&datasetId=" +
            datasetId
        ),
        doAjax(
          API_SERVER +
            "api/v1/bounds?embedding=" +
            obsmKey +
            "&datasetId=" +
            datasetId
        )
      ).then(function (s, b) {
        active.samples = s[0];
        active.bounds = b[0];

        // calculate viewport bounding values
        const longitude = (active.bounds.x.max + active.bounds.x.min) / 2;
        const latitude = (active.bounds.y.max + active.bounds.y.min) / 2;
        bboxMinLon = Math.max(active.bounds.x.min, -179);
        bboxMinLat = Math.max(active.bounds.y.min, -89);
        bboxMaxLon = Math.min(active.bounds.x.max, 179);
        bboxMaxLat = Math.min(active.bounds.y.max, 89);
        // create viewport and fit bounds
        const { WebMercatorViewport } = deck;
        currentViewState = new WebMercatorViewport({
          width,
          height,
          longitude,
          latitude,
          zoom: 4,
        }).fitBounds(
          [
            [bboxMinLon, bboxMinLat],
            [bboxMaxLon, bboxMaxLat],
          ],
          {
            padding: {
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            },
          }
        );
        embeddingViewState = currentViewState;
        loadData();
        // lazy load obs resources
        $.each(active.dataset.data_obs, function (key, value) {
          doAjax(
            API_SERVER +
              "api/v1/labels?obs=" +
              value.name +
              "&datasetId=" +
              datasetId
          );
        });
        // Lazy load obsm resources
        $.each(active.dataset.data_obsm, function (key, value) {
          doAjax(
            API_SERVER +
              "api/v1/coordinates?embedding=" +
              value +
              "&datasetId=" +
              datasetId
          );
          doAjax(
            API_SERVER +
              "api/v1/bounds?embedding=" +
              value +
              "&datasetId=" +
              datasetId
          );
        });
      }, showError);
    };

    const loadData = function () {
      if (colorScaleKey) {
        let url;
        if (colorScaleType === "gene") {
          url =
            API_SERVER +
            "api/v1/labels?gene=" +
            colorScaleKey +
            "&datasetId=" +
            datasetId;
        } else {
          url =
            API_SERVER +
            "api/v1/labels?obs=" +
            colorScaleKey +
            "&datasetId=" +
            datasetId;
        }
        const requestLabels = doAjax(url, false);
        if (requestLabels.status === 200) {
          if (colorScaleType === "gene") {
            active.min = 0;
            active.max = getMax(requestLabels.responseJSON);
          }
          active.samples = active.samples.map(function (e, i) {
            return [e[0], e[1], requestLabels.responseJSON[i]];
          });
        }
      }
      render();
      endLoader();
    };

    const debouncedLoadData = $.debounce(300, loadData);

    const render = function () {
      // init deck
      const { ScatterplotLayer } = deck;

      // set cell count
      $("#cell-count-value").html(active.samples.length.toLocaleString());
      // set embedding key
      $("#canvas-obsm-key").text(obsmKey);
      if (colorScaleKey) {
        $("#color-scale-value").html(colorScaleKey);
        $("#color-scale-value").removeClass("d-none");
        $("#color-scale").removeClass("disabled");
        $("#color-scale-remove").removeClass("d-none");
        if (colorScaleType === "gene") {
          if (!$("#gene-deg-" + escapeSelector(colorScaleKey)).length) {
            $("#search-genes-selected").append(
              $("<button/>")
                .attr("type", "button")
                .attr("id", "gene-deg-" + colorScaleKey)
                .attr("data-gene", colorScaleKey)
                .addClass("btn-gene-select btn btn-outline-info btn-sm active")
                .text(colorScaleKey)
            );
          } else if (
            !$("#gene-deg-" + escapeSelector(colorScaleKey)).hasClass("active")
          ) {
            $("#gene-deg-" + escapeSelector(colorScaleKey)).addClass("active");
          }
        }
      } else {
        // decolor
        $(".colourise").removeClass("active");
        $("#color-scale-remove").addClass("d-none");
        $("#color-scale-value").empty().addClass("d-none");
        $("#color-scale").addClass("disabled");
        $(".btn-gene-select").removeClass("active");
      }
      if (colorScaleId) {
        let colorScaleIdCat = $("#collapse-" + colorScaleId).attr("data-cat");
        if (colorScaleIdCat) {
          $("#collapse-cat-" + colorScaleIdCat).collapse("show");
        }
        $("#collapse-" + colorScaleId).collapse("show");
        $("#colourise" + colorScaleId).addClass("active");
      }

      let myColor;
      const myRadius = function () {
        return 100;
      };

      if (["categorical", "boolean", "date"].includes(colorScaleType)) {
        const arr =
          active.dataset.data_obs[
            colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
          ].values;
        const catColors = d3scale
          .scaleOrdinal()
          .domain(Object.values(arr))
          .range([
            "#2f4f4f",
            "#2e8b57",
            "#7f0000",
            "#808000",
            "#483d8b",
            "#008000",
            "#000080",
            "#8b008b",
            "#b03060",
            "#ff0000",
            "#00ced1",
            "#ff8c00",
            "#ffff00",
            "#00ff00",
            "#8a2be2",
            "#00ff7f",
            "#dc143c",
            "#00bfff",
            "#f4a460",
            "#0000ff",
            "#f08080",
            "#adff2f",
            "#d8bfd8",
            "#ff00ff",
            "#1e90ff",
            "#90ee90",
            "#ff1493",
            "#7b68ee",
            "#ee82ee",
            "#ffdab9",
          ]);
        const checkboxCheck = {};
        for (const [k, v] of Object.entries(arr)) {
          if (colorScaleType === "boolean") {
            checkboxCheck[v] =
              v ===
              $(
                "#obs-list-" +
                  colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() +
                  ' input[name="obs-' +
                  colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() +
                  '"]:checked'
              ).val();
          } else {
            document.getElementById(
              colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + "-" + k
            ).style.backgroundColor = catColors(v);
            checkboxCheck[v] = $(
              "#obs-list-" +
                colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() +
                ' input[name="obs-' +
                v +
                '"]'
            ).is(":checked");
          }
        }
        myColor = function (d) {
          // Public Method
          if (checkboxCheck[d]) {
            return catColors(d);
          } else {
            return "#efefef";
          }
        };
        // myRadius = function (d) {
        //   if (checkboxCheck[d]) {
        //     return 100
        //   } else {
        //     return 10
        //   }
        // }
      } else if (colorScaleType === "continuous") {
        myColor = d3scale
          .scaleSequential()
          .domain([
            active.dataset.data_obs[
              colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
            ].min,
            active.dataset.data_obs[
              colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
            ].max,
          ])
          .interpolator(d3scale.interpolateViridis);
        $("#continuous-legend").empty();
        createLegend(myColor);
      } else if (colorScaleType === "gene") {
        myColor = d3scale
          .scaleSequential()
          .domain([active.min, active.max])
          .interpolator(d3scale.interpolateViridis);
        $("#continuous-legend").empty();
        createLegend(myColor);
      } else {
        myColor = function () {
          return "#000000";
        };
      }

      // calculate inverse scale value
      const radiusMin = 1;
      const radiusMax = 8;
      const countMin = 1;
      const countMax = 90000;
      const countInput = active.samples.length;
      let inverseScaled = radiusMin;
      if (countInput <= countMax) {
        inverseScaled =
          radiusMax -
          (((countInput - countMin) * (radiusMax - radiusMin)) /
            (countMax - countMin) +
            radiusMin);
      }

      // create data layer
      const layer = new ScatterplotLayer({
        data: active.samples,
        radiusScale: inverseScaled, // 6,
        radiusMinPixels: 1,
        radiusMaxPixels: 50,
        getPosition: function (d) {
          return [d[0], d[1], 0];
        },
        getFillColor: function (d) {
          const v = d3scale.rgb(myColor(d[2]));
          return [v.r, v.g, v.b];
          // return [160, 160, 180, 200]
        },
        getRadius: (d) => myRadius(d),
        pickable: true, // enable picking (i.e. tooltips)
        updateTriggers: {
          getFillColor: myColor,
          initialViewState: currentViewState,
        },
      });

      // update layer
      cellDeck.setProps({
        layers: [layer],
        initialViewState: currentViewState,
      });
    };

    // create continuous color legend
    function createLegend(colorscale) {
      const selectorId = "#continuous-legend";

      const legendheight = 200;
      const legendwidth = 80;
      const margin = { top: 10, right: 60, bottom: 10, left: 0 };

      const canvas = d3scale
        .select(selectorId)
        .style("height", legendheight + "px")
        .style("width", "100%") // legendwidth + 'px')
        .style("position", "absolute")
        .style("bottom", "10px")
        .style("left", "20px")
        .append("canvas")
        .attr("height", legendheight - margin.top - margin.bottom)
        .attr("width", 1)
        .style("height", legendheight - margin.top - margin.bottom + "px")
        .style("width", legendwidth - margin.left - margin.right + "px")
        .style("border", "1px solid #000")
        .style("position", "absolute")
        .style("top", margin.top + "px")
        .style("left", margin.left + "px")
        .node();

      const ctx = canvas.getContext("2d");

      const legendscale = d3scale
        .scaleLinear()
        .range([legendheight - margin.top - margin.bottom, 1])
        .domain(colorscale.domain());

      // image data hackery based on http://bl.ocks.org/mbostock/048d21cf747371b11884f75ad896e5a5
      const image = ctx.createImageData(1, legendheight);
      d3scale.range(legendheight).forEach(function (i) {
        const c = d3scale.rgb(colorscale(legendscale.invert(i)));
        image.data[4 * i] = c.r;
        image.data[4 * i + 1] = c.g;
        image.data[4 * i + 2] = c.b;
        image.data[4 * i + 3] = 255;
      });
      ctx.putImageData(image, 0, 0);

      // A simpler way to do the above, but possibly slower. keep in mind the legend width is stretched because the width attr of the canvas is 1
      // See http://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
      /*
              d3scale.range(legendheight).forEach(function(i) {
              ctx.fillStyle = colorscale(legendscale.invert(i));
              ctx.fillRect(0,i,1,1);
              });
              */

      const legendaxis = d3scale
        .axisRight()
        .scale(legendscale)
        .tickSize(6)
        .ticks(6);

      const svg = d3scale
        .select(selectorId)
        .append("svg")
        .attr("height", legendheight + "px")
        .attr("width", legendwidth + "px")
        .style("position", "absolute")
        .style("left", "0px")
        .style("top", "0px");

      svg
        .append("g")
        .attr("class", "axis")
        .attr(
          "transform",
          "translate(" +
            (legendwidth - margin.left - margin.right - 1) +
            "," +
            (margin.top - 1) +
            ")"
        )
        .call(legendaxis);
    }

    // public methods
    this.initialize = function () {
      // create the scatterplot tool.
      $("#" + this.attr("id")).append(
        $("<div/>")
          .addClass("card-body")
          .append($("<div/>").attr("id", "continuous-legend"))
          .append($("<div/>").attr("id", "loader"))
          .append($("<div/>").attr("id", "canvas-loader"))
          .append(
            $("<div/>")
              .attr("id", "canvas-controls")
              .attr(
                "class",
                "d-flex justify-content-end flex-row flex-wrap mt-3 py-3 px-3 w-100 gap-1"
              )
              .append(
                $("<div/>")
                  .addClass("btn-group mr-1")
                  .append(
                    $("<a/>")
                      .attr("id", "canvas-zoom-plus")
                      .addClass("btn btn-white")
                      .append($("<i/>").addClass("fa fa-search-plus"))
                  )
                  .append(
                    $("<a/>")
                      .attr("id", "canvas-zoom-minus")
                      .addClass("btn btn-white")
                      .append($("<i/>").addClass("fa fa-search-minus"))
                  )
                  .append(
                    $("<a/>")
                      .attr("id", "canvas-zoom-reset")
                      .addClass("btn btn-white")
                      .append($("<i/>").addClass("fa fa-expand"))
                  )
              )
              .append(
                $("<div/>")
                  .addClass("btn-group mr-1")
                  .append(
                    $("<a/>")
                      .attr("id", "color-scale")
                      .addClass("btn btn-white text-nowrap")
                      .append($("<i/>").addClass("fas fa-tint"))
                      .append(
                        $("<span/>")
                          .attr("id", "color-scale-value")
                          .addClass("d-none")
                      )
                  )
                  .append(
                    $("<a/>")
                      .attr("id", "color-scale-remove")
                      .addClass("btn btn-white text-nowrap d-none")
                      .append($("<i/>").addClass("fa fa-times"))
                  )
              )
              .append(
                $("<div/>")
                  .addClass("btn-group mr-1")
                  .append(
                    $("<a/>")
                      .attr("id", "color-scale")
                      .addClass("btn btn-white text-nowrap")
                      .append($("<i/>").addClass("fas fa-draw-polygon"))
                      .append(
                        $("<span/>").attr("id", "cell-count-value").text(0)
                      )
                  )
              )
              .append(
                $("<div/>")
                  .addClass("btn-group dropdown")
                  .append(
                    $("<button/>")
                      .attr("id", "canvas-obsm-key")
                      .attr("type", "button")
                      .attr("data-toggle", "dropdown")
                      .attr("aria-haspopup", "true")
                      .attr("aria-expanded", "false")
                      .addClass("btn btn-white dropdown-toggle")
                      .text("Embedding")
                  )
                  .append(
                    $("<div/>")
                      .attr("id", "canvas-obsm-dropdown")
                      .attr("aria-labelledby", "canvas-obsm-key")
                      .addClass("dropdown-menu")
                      .css("z-index", "10000")
                  )
              )
          )
          .append($("<div/>").attr("id", "canvas_plot"))
      );

      // set container size
      $("#" + this.attr("id"))
        .parent()
        .height(height);
      $("#" + this.attr("id")).height(height);
      $("#spatial-column").height(height);
      $("#spatial-container").height(height * (2 / 3));
      $("#spatial-ref-container").height(height * (1 / 3));
      // $('#' + this.attr('id')).width(width)

      // load dataset
      startLoader();
      $.when(doAjax(API_SERVER + "api/v1/datasets/" + datasetId)).then(
        function (d1) {
          // update active dataset
          active.dataset = d1;
          // load cookies
          // colorScaleKey = Cookies.get('ds' + datasetId + '-obs-name')
          // colorScaleType = Cookies.get('ds' + datasetId + '-obs-type') // @TODO
          // populate embedding options
          $.each(d1.data_obsm, function (key, obsm) {
            const parts = obsm.split(":");
            let html;
            if (parts.length > 1) {
              html =
                parts[1] +
                ' <span class="badge badge-secondary">' +
                parts[0] +
                "</span>";
            } else {
              html = obsm;
            }
            $("#canvas-obsm-dropdown").append(
              $("<a/>")
                .attr("id", "canvas-obsm-key-" + obsm)
                .attr("href", "#")
                .attr("data-name", obsm)
                .addClass("dropdown-item canvas-obsm-key")
                .html(html)
            );
          });

          // process embedding option
          let defaultKey;
          if (jQuery.inArray("X_umap", active.dataset.data_obsm) !== -1) {
            defaultKey = "X_umap";
          } else {
            defaultKey = Object.values(active.dataset.data_obsm)[0];
          }

          obsmKey = Cookies.get("ds" + datasetId + "-obsm-key") || null;
          colorScaleId = Cookies.get("ds" + datasetId + "-obs-id") || null;
          colorScaleKey = Cookies.get("ds" + datasetId + "-obs-name") || null;
          colorScaleType = Cookies.get("ds" + datasetId + "-obs-type") || null;

          obsmKey =
            jQuery.inArray(obsmKey, active.dataset.data_obsm) === -1
              ? defaultKey
              : obsmKey;
          Cookies.set("ds" + datasetId + "-obsm-key", obsmKey, {
            expires: 30,
            sameSite: "Strict",
            path: window.location.pathname,
          });

          if (
            (colorScaleKey &&
              colorScaleType !== "gene" &&
              !(
                colorScaleKey.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() in
                active.dataset.data_obs
              )) ||
            (colorScaleKey &&
              colorScaleType === "gene" &&
              active.dataset.data_var.indexOf(colorScaleKey) === -1)
          ) {
            colorScaleKey = null;
            colorScaleId = null;
            colorScaleType = null;
            Cookies.remove("ds" + datasetId + "-obs-name", {
              path: window.location.pathname,
            });
            Cookies.remove("ds" + datasetId + "-obs-id", {
              path: window.location.pathname,
            });
            Cookies.remove("ds" + datasetId + "-obs-type", {
              path: window.location.pathname,
            });
          }

          // get data
          loadEmbedding();

          if (colorScaleType === "gene") {
            getGeneDiseaseInfo(colorScaleKey);
          }
        },
        showError
      );

      // init deck
      const { DeckGL, WebMercatorViewport } = deck;
      const viewport = new WebMercatorViewport({
        width: "100%",
        height,
        longitude: 0,
        latitude: 0,
        zoom: 0,
      });
      currentViewState = viewport;
      deck.log.enable(false);
      deck.log.level = 3;
      // create deck
      cellDeck = new DeckGL({
        container: "canvas_plot",
        width,
        height,
        initialViewState: viewport,
        controller: true,
        getTooltip: ({ object }) => object && object[2],
        onViewStateChange: ({ viewState }) => {
          // we can manipulate the viewState here
          currentViewState = viewState;
        },
      });

      // convert filesize
      const size = $("#ds-size").html();
      const i = Math.floor(Math.log(size) / Math.log(1024));
      $("#ds-size").html(
        (size / Math.pow(1024, i)).toFixed(2) * 1 +
          " " +
          ["B", "kB", "MB", "GB", "TB"][i]
      );

      return this;
    };

    const getGeneDiseaseInfo = function (gene) {
      $.when(
        doAjax(API_SERVER + "api/v1/search/disease_gene?search=" + gene, false)
      ).then(function (d) {
        populateGeneDiseaseInfo(gene, d.results);
      });
    };

    const populateGeneDiseaseInfo = function (gene, info) {
      const geneDiseaseInfo = $("#gene-disease-info");
      geneDiseaseInfo.empty();
      geneDiseaseInfo.removeClass();
      if (info.length) {
        geneDiseaseInfo.addClass("mb-4");
        geneDiseaseInfo.append($("<h6/>").addClass("mb-0").text(gene));
        const infoList = $("<ul/>")
          .addClass("list-group")
          .css("max-height", "15vh")
          .css("overflow-y", "auto");
        info.forEach(function (i) {
          const infoItem = $("<li/>").addClass("list-group-item p-3");
          Object.keys(i).forEach(function (k) {
            if (k !== "Gene mutation") {
              infoItem.append(
                $("<p>")
                  .addClass("m-0")
                  .html("<strong>" + k + "</strong>: " + i[k])
              );
            }
          });
          infoList.append(infoItem);
        });
        geneDiseaseInfo.append(infoList);
      }
    };

    this.colorize = function (el) {
      if ($(el).hasClass("active")) {
        decolorize();
      } else {
        $(".colourise").removeClass("active");
        $(".btn-gene-select").removeClass("active");
        if (el.id === "genes") {
          colorScaleKey = el.selectedItems[0];
          colorScaleId = 0;
          colorScaleType = "gene";
        } else if ($(el).hasClass("btn-gene-select")) {
          colorScaleKey = $(el).text();
          colorScaleId = 0;
          colorScaleType = "gene";
          const gene = $(el).attr("data-gene");
          $(
            "#gene-deg-" +
              escapeSelector(gene) +
              ",#disease-gene-deg-" +
              escapeSelector(gene)
          ).addClass("active");
        } else {
          colorScaleKey = $(el).data("name");
          colorScaleId = $(el).data("id");
          colorScaleType = $(el).data("type");
          $("#colourise" + colorScaleId).addClass("active");
        }

        if (colorScaleType === "gene") getGeneDiseaseInfo(colorScaleKey);

        Cookies.set("ds" + datasetId + "-obs-name", colorScaleKey, {
          expires: 30,
          sameSite: "Strict",
          path: window.location.pathname,
        });
        Cookies.set("ds" + datasetId + "-obs-id", colorScaleId, {
          expires: 30,
          sameSite: "Strict",
          path: window.location.pathname,
        });
        Cookies.set("ds" + datasetId + "-obs-type", colorScaleType, {
          expires: 30,
          sameSite: "Strict",
          path: window.location.pathname,
        });

        startLoader();
        abort();
        setTimeout(function () {
          debouncedLoadData();
        }, 100); // Defer to improve UX
      }
    };

    this.redraw = function () {
      startLoader();
      render();
      endLoader();
    };

    this.removeColor = function () {
      decolorize();
    };

    this.resetZoom = function () {
      const { WebMercatorViewport } = deck;
      const viewState = embeddingViewState || cellDeck.viewManager.viewState;
      currentViewState = new WebMercatorViewport({
        width: cellDeck.canvas.width,
        height: viewState.height,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
      });
      cellDeck.setProps({ initialViewState: currentViewState });
    };

    this.zoomIn = function () {
      const { WebMercatorViewport } = deck;
      const viewState = currentViewState || cellDeck.viewManager.viewState;
      currentViewState = new WebMercatorViewport({
        width: viewState.width,
        height: viewState.height,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom + 1,
      });
      cellDeck.setProps({ initialViewState: currentViewState });
    };

    this.zoomOut = function () {
      const { WebMercatorViewport } = deck;
      const viewState = currentViewState || cellDeck.viewManager.viewState;
      currentViewState = new WebMercatorViewport({
        width: viewState.width,
        height: viewState.height,
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom - 1,
      });
      cellDeck.setProps({ initialViewState: currentViewState });
    };

    this.embedding = function (el) {
      obsmKey = $(el).data("name");
      Cookies.set("ds" + datasetId + "-obsm-key", obsmKey, {
        expires: 30,
        sameSite: "Strict",
        path: window.location.pathname,
      });
      startLoader();
      abort();
      loadEmbedding();
    };

    $(".select2-gene-search")
      .select2({
        // closeOnSelect: false,
        width: "100%",
        sorter: (data) => data.sort((a, b) => a.text.localeCompare(b.text)),
        ajax: {
          url: API_SERVER + "api/v1/datasets/" + datasetId + "/search/genes",
          data: function (params) {
            const query = {
              search: params.term,
              type: "public",
            };

            // Query parameters will be ?search=[term]&type=public
            return query;
          },
        },
      })
      .on("select2:select", function (e) {
        const data = e.params.data;
        if ($("#gene-deg-" + escapeSelector(data.id)).length) {
          $("button[data-gene='" + escapeSelector(data.id) + "']").trigger(
            "click"
          );
        } else {
          $("#search-genes-selected").append(
            $("<button/>")
              .attr("type", "button")
              .attr("id", "gene-deg-" + data.id)
              .attr("data-gene", data.id)
              .addClass("btn-gene-select btn btn-outline-info btn-sm")
              .text(data.id)
          );
          $("button[data-gene='" + escapeSelector(data.id) + "']").trigger(
            "click"
          );
        }
      });

    $(".select2-disease-search")
      .select2({
        placeholder: "Search for diseases",
        width: "100%",
        sorter: (data) => data.sort((a, b) => a.text.localeCompare(b.text)),
        ajax: {
          url: API_SERVER + "api/v1/datasets/" + datasetId + "/search/diseases",
          data: function (params) {
            const query = {
              search: params.term,
              type: "public",
            };

            // Query parameters will be ?search=[term]&type=public
            return query;
          },
        },
      })
      .on("select2:select", function (e) {
        const data = e.params.data;
        const categories = data.values;
        $("#search-genes-disease-set").empty();
        $.each(categories, function (cat) {
          if (cat.toLowerCase() !== "default") {
            $("#search-genes-disease-set").append(
              $("<div/>").append("<p/>").text(cat.toUpperCase())
            );
          }
          $.each(categories[cat], function (gene) {
            let active = false;
            if (
              $("#gene-deg-" + escapeSelector(categories[cat][gene]["gene"]))
                .length
            ) {
              active = $(
                "#gene-deg-" + escapeSelector(categories[cat][gene]["gene"])
              ).hasClass("active");
            }
            $("#search-genes-disease-set").append(
              $("<button/>")
                .attr("type", "button")
                .attr("id", "disease-gene-deg-" + categories[cat][gene]["gene"])
                .attr("data-gene", categories[cat][gene]["gene"])
                .attr("title", categories[cat][gene]["info"].join("; "))
                .addClass(
                  "btn-gene-select btn btn-outline-info btn-sm btn-disease-gene"
                )
                .text(categories[cat][gene]["gene"])
                .addClass(active ? "active" : "")
                .tooltip({
                  trigger: "hover",
                  delay: { show: 350 },
                  placement: "top",
                  fallbackPlacement: "flip",
                  boundary: "viewport",
                })
            );
          });
        });
      });

    return this.initialize();
  };
})(jQuery);
