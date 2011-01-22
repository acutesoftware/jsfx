var jsfx = {};
(function () {
    var Parameters = [];

    this.addParam = function (name, min, max, def, group) {
        var param = { name: name,
                      min: min,
                      max: max,
                      def: def,
                      node: 0,
                      group: group};
        Parameters.push(param);
    };
    
    this.loadParameters = function () {
        var ap = this.addParam,
            al = this.addLine;
        ap("Master Volume",  0, 1, 0.3, -1);
        
        ap("Attack Time",    0, 1, 0.1, 0); // seconds
        ap("Sustain Time",   0, 2, 0.4, 0); // seconds
        ap("Sustain Punch",  0, 3, 2, 0);
        ap("Decay Time",     0, 2, 1, 0); // seconds
        
        ap("Min Frequency",   20, 2000, 440, 1);
        ap("Start Frequency", 20, 2000, 440, 1);
        ap("Max Frequency",   20, 2000, 440, 1);
        ap("Slide",           -1, 1, 0, 1);
        ap("Delta Slide",     -1, 1, 0, 1);
        ap("Vibrato Depth",    0, 1, 0.1, 1);
        ap("Vibrato Frequency", 0.01, 48, 1, 1);
        
        ap("Change Amount", 0, 100, 50, 2);
        ap("Change Speed",  0, 100, 50, 2);
        
        ap("Square Duty", 0, 100, 50, 3);
        ap("Duty Sweep",  0, 100, 50, 3);
        
        ap("Repeat Speed", 0, 100, 50, 4);
        
        ap("Phaser Offset", 0, 100, 50, 5);
        ap("Phaser Sweep",  0, 100, 50, 5);
        
        ap("LP Filter Cutoff", 0, 100, 50, 6);
        ap("LP Filter Cutoff Sweep", 0, 100, 50, 6);
        ap("LP Filter Resonance",    0, 100, 50, 6);
        ap("HP Filter Cutoff",       0, 100, 50, 6);
        ap("HP Filter Cutoff Sweep", 0, 100, 50, 6);
    };
    
    this.randomize = function(){
        var len = Parameters.length;
        for (var i = 0; i < len; i++) {
            var param = Parameters[i];
            if( param.group === -1 ) continue;
            param.node.value = param.min + (param.max - param.min) * Math.random();
        }
        this.play();
    }
    
    this.play = function(){
        log('get params');
        var params = this.getParams();
        log('generate');
        var data = this.generate(params);
        log('make wave');
        var wave = audio.make(data);
        log('play');
        wave.play();
        log('done')
        return wave;
    }
    
    this.generate = function(params){
        // useful consts
        var TAU = 2 * Math.PI;
        var SampleRate = audio.SampleRate;
        
        // enveloping initialization
        var _ss = 1.0 + params.SustainPunch;
        var envelopes = [ {from: 0.0, to: 1.0, time: params.AttackTime},
                          {from: _ss, to: 1.0, time: params.SustainTime},
                          {from: 1.0, to: 0.0, time: params.DecayTime}];
        var envelopes_len = envelopes.length;
        
        // envelope sample calculation
        for(var i = 0; i < envelopes_len; i++){
            envelopes[i].samples = (envelopes[i].time * SampleRate) | 0
        }
        
        // envelope loop variables
        var envelope = undefined;
        var envelope_cur = 0.0;
        var envelope_idx = -1;
        var envelope_increment = 0.0;
        var envelope_last = -1;
        
        // count total samples
        var totalSamples = 0;
        for(var i = 0; i < envelopes_len; i++){
            totalSamples += envelopes[i].samples;
        }
        
        // out data samples
        var out = new Array(totalSamples);
        var sample = 0;
        
        // main generator        
        var generator = params.generator;
        var generator_A = 0;
        var generator_B = 0;
        
        // phase calculation
        var phase = 0;
        var phase_speed = params.StartFrequency * TAU / SampleRate;
        
        // frequency limiter
        if(params.MinFrequency > params.StartFrequency)
            params.MinFrequency = params.StartFrequency;
            
        if(params.MaxFrequency < params.StartFrequency)
            params.MaxFrequency = params.StartFrequency;
        
        var phase_min_speed = params.MinFrequency * TAU / SampleRate;
        var phase_max_speed = params.MaxFrequency * TAU / SampleRate;
        
        // frequency vibrato
        var vibrato_phase = 0;
        var vibrato_phase_speed = params.VibratoFrequency * TAU / SampleRate;
        var vibrato_amplitude = params.VibratoDepth;
        var vibrato_phase_mod = 0;
        
        // slide calculation
        var slide = 1.0 + Math.pow(params.Slide, 3.0) / 1000;
        var delta_slide = params.DeltaSlide * params.DeltaSlide * params.DeltaSlide / 1000000;
        
        // master volume controller
        var master_volume = params.MasterVolume;
        
        for(var i = 0; i < totalSamples; i++){
            // main generator
            sample = generator(phase, generator_A, generator_B);
            
            // phase calculation
            phase += phase_speed;
            
            // phase slide calculation
            slide += delta_slide;
            phase_speed *= slide;
            
            // frequency limiter
            if (phase_speed > phase_max_speed){
                phase_speed = phase_max_speed;
            } else if(phase_speed < phase_min_speed){
                phase_speed = phase_min_speed;
            }
            
            // frequency vibrato
            vibrato_phase += vibrato_phase_speed;
            vibrato_phase_mod = phase_speed * Math.sin(vibrato_phase) * vibrato_amplitude;
            phase += vibrato_phase_mod;
            
            // envelope processing
            if( i > envelope_last ){
                envelope_idx += 1;
                envelope = envelopes[envelope_idx];
                envelope_cur = envelope.from;
                envelope_increment = (envelope.to - envelope.from) / envelope.samples;
                envelope_last += envelope.samples;
            }
            sample *= envelope_cur;
            envelope_cur += envelope_increment;
            
            // master volume controller
            sample *= master_volume;
            
            // prepare for next sample
            out[i] = sample;
        }
        return out;
    }
    
    this.createTable = function (id) {
        this.loadParameters();
        var frag = document.createDocumentFragment(),
            len = Parameters.length,
            lastgroup = 0;
        for (var i = 0; i < len; i += 1) {
            var param = Parameters[i],
                row = document.createElement("tr"),
                fld = document.createElement("td"),
                input = document.createElement("input");
            // add caption
            fld.appendChild(document.createTextNode(param.name));
            row.appendChild(fld);
            // create sliders
            fld = document.createElement("td");
            input.type = "range";
            input.step = (param.max - param.min) / 1000.0;
            input.min  = param.min;
            input.max  = param.max;
            input.value = param.def;
            param.node = input;
            fld.appendChild(input);
            row.appendChild(fld);
            frag.appendChild(row);
            
            if (param.group !== lastgroup) {
                row.className += 'line';
            }
            lastgroup = param.group;
        }
        var paramtable = document.getElementById("param-table");
        paramtable.appendChild(frag);
    };

    var nameToParam = function(name){
        return name.replace(" ", "");
    }
    
    this.getParams = function () {
        var values = {},
            len = Parameters.length;
        for (var i = 0; i < len; i += 1) {
            var param = Parameters[i];
            values[nameToParam(param.name)] = parseFloat(param.node.value);
        }
        
        // hack
        var param = false;
        var generators = document.getElementById("generators").generator;
        for(var i = 0; i < generators.length; i++){
            if (generators[i].checked)
                param = generators[i].value;
        }
        
        values.generator = audio.generators[param]
        if(values.generator === undefined)
            values.generator = audio.generators.square;
        return values;
    };
    
    this.setParams = function (params) {
        var len = Parameters.length;
        for (var e in params){
            for (var i = 0; i < len; i += 1){
                var param = Parameters[i];
                if( nameToParam(param.name) === e ){
                    param.node.value = params[e];
                    break;
                }
            }
        }
    }
    
    this.resetParams = function () {
        var len = Parameters.length;
        for (var i = 0; i < len; i += 1) {
            var param = Parameters[i];
            param.node.value = param.def;
        }
    }
}).apply(jsfx);
